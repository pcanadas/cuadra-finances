/**
 * Transfer pairing logic — when a transaction is categorised as an internal
 * transfer with a destination account, create or match its counterpart in the
 * destination account so the money flow is reflected on both sides.
 */

import { newId } from '../db/ids'
import { isManualTx } from '../db/records'

const DAY_MS = 86_400_000

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Un traspaso entre cuentas propias no es ni ingreso ni gasto: lo es si su categoría es de
 * transferencia o si ya está emparejado con su contrapartida (aunque luego se recategorice).
 */
export function isTransferTx(t, transferCatIds) {
  return transferCatIds.has(t.categoria) || !!t.transferPairId
}

/**
 * Al importar (p. ej. un extracto con varias cuentas), empareja la salida de una cuenta con la
 * entrada del mismo importe en otra cuenta (±3 días) si al menos un lado parece un traspaso:
 * ya tiene categoría de transferencia o el concepto lo dice. Ambos lados quedan como
 * transferencia y con el mismo transferPairId. Devuelve las filas nuevas (no muta las de entrada).
 *
 * @param {object[]} rows filas a importar, ya con accountId
 * @param {Set<string>} transferCatIds
 * @param {string} defaultTransferCatId categoría para el lado que no la tenía
 */
export function pairImportedTransfers(rows, transferCatIds, defaultTransferCatId) {
  const looksLikeTransfer = (t) =>
    transferCatIds.has(t.categoria) || /\b(TRANSF?|TRASPASO|TRANSFERENCIA)\b/i.test(t.descripcion || '')
  const out = rows.map((r) => ({ ...r }))
  const used = new Set()

  out.forEach((out1, i) => {
    if (out1.importe >= 0 || used.has(i) || out1.transferPairId) return
    const amount = Math.abs(out1.importe)
    const date = new Date(out1.fechaContable).getTime()
    let best = -1
    let bestDiff = Infinity
    out.forEach((in1, j) => {
      if (used.has(j) || j === i || in1.transferPairId || in1.importe <= 0) return
      if (!in1.accountId || in1.accountId === out1.accountId) return
      if (Math.abs(in1.importe - amount) > 0.01) return
      if (!looksLikeTransfer(out1) && !looksLikeTransfer(in1)) return
      const diff = Math.abs(new Date(in1.fechaContable).getTime() - date)
      if (diff <= 3 * DAY_MS && diff < bestDiff) { best = j; bestDiff = diff }
    })
    if (best === -1) return

    const in1 = out[best]
    const categoria = [out1, in1].map((t) => t.categoria).find((c) => transferCatIds.has(c)) ?? defaultTransferCatId
    const pairId = newId()
    for (const t of [out1, in1]) {
      if (!transferCatIds.has(t.categoria)) { t.categoria = categoria; t.subcategoria = null }
      t.transferPairId = pairId
    }
    used.add(i)
    used.add(best)
  })
  return out
}

/** Return the destination account id for a transfer transaction (subcategory wins). */
export function resolveTransferDestination(tx, categories, subcategories) {
  // Subcategory-level destination takes priority
  if (tx.subcategoria) {
    const sub = subcategories.find((s) => s.id === tx.subcategoria)
    if (sub?.cuentaDestinoId) return sub.cuentaDestinoId
  }
  // Fall back to category-level destination
  if (tx.categoria) {
    const cat = categories.find((c) => c.id === tx.categoria)
    if (cat?.cuentaDestinoId) return cat.cuentaDestinoId
  }
  return null
}

/** Find the best matching income in the destination account (date ±tolerance days, same abs amount). */
export function findMatchingTransaction(tx, allTransactions, destAccountId, toleranceDays = 3) {
  const absAmount = Math.abs(tx.importe)
  const txDate = new Date(tx.fechaContable).getTime()
  const tolerance = toleranceDays * DAY_MS

  let best = null
  let bestDiff = Infinity

  for (const t of allTransactions) {
    if (t.accountId !== destAccountId) continue
    if (t.importe <= 0) continue                       // must be income
    if (Math.abs(t.importe - absAmount) > 0.01) continue // same abs amount (float tolerance)
    if (t.transferPairId) continue                      // already paired

    const diff = Math.abs(new Date(t.fechaContable).getTime() - txDate)
    if (diff <= tolerance && diff < bestDiff) {
      best = t
      bestDiff = diff
    }
  }
  return best
}

// ── main pairing function ──────────────────────────────────────────────────

/**
 * Handle the transfer pairing for a single transaction that has just been
 * categorised as an internal transfer.
 *
 * @param {object}   tx               The source transaction (expense side)
 * @param {object[]} allTransactions   All transactions in the store
 * @param {object[]} categories
 * @param {object[]} subcategories
 * @param {object[]} accounts
 * @param {object}   actions           { updateTransaction, addManualTransaction, deleteTransaction }
 * @returns {Promise<void>}
 */
export async function handleTransferPairing(
  tx, allTransactions, categories, subcategories, accounts, actions,
) {
  const destAccountId = resolveTransferDestination(tx, categories, subcategories)
  if (!destAccountId) return

  const destAccount = accounts.find((a) => a.id === destAccountId)
  if (!destAccount) return

  const pairId = newId()

  // Mark the original transaction
  await actions.updateTransaction(tx.id, { transferPairId: pairId })

  const isCash = destAccount.tipo === 'efectivo'

  if (!isCash) {
    // Try to match an existing imported transaction in the destination account
    const match = findMatchingTransaction(tx, allTransactions, destAccountId)
    if (match) {
      await actions.updateTransaction(match.id, {
        transferPairId: pairId,
        categoria: tx.categoria,
        subcategoria: tx.subcategoria || null,
      })
      return
    }
  }

  // Cash account or no match found → create counterpart
  const originAccount = accounts.find((a) => a.id === tx.accountId)
  const originName = originAccount?.nombre || 'otra cuenta'

  await actions.addManualTransaction({
    fechaContable: tx.fechaContable,
    descripcion: `Traspaso desde ${originName}`,
    importe: Math.abs(tx.importe),
    categoria: tx.categoria,
    subcategoria: tx.subcategoria || null,
    accountId: destAccountId,
    transferPairId: pairId,
    esContrapartida: true,
  })
}

/**
 * Undo a transfer pairing — called when a transaction is re-categorised away
 * from a transfer category.
 */
export async function undoTransferPairing(tx, allTransactions, actions) {
  if (!tx.transferPairId) return

  const pair = allTransactions.find(
    (t) => t.transferPairId === tx.transferPairId && t.id !== tx.id,
  )

  // Clean original
  await actions.updateTransaction(tx.id, { transferPairId: null })

  if (!pair) return

  if (pair.esContrapartida) {
    // Auto-created → delete it
    await actions.deleteTransaction(pair.id)
  } else {
    // Was a matched bank transaction → unlink and un-categorise
    await actions.updateTransaction(pair.id, {
      transferPairId: null,
      categoria: null,
      subcategoria: null,
    })
  }
}

// ── sincronizar con la configuración de las categorías ─────────────────────

/**
 * Pone al día las contrapartidas de TODOS los traspasos según la cuenta destino de su
 * categoría o subcategoría (p. ej. al ponerle «Efectivo» a la categoría Cajero, cada retirada
 * del banco aparece como entrada en Efectivo; al quitarla, esas entradas desaparecen).
 * - Se respetan los emparejamientos entre dos movimientos reales del banco y las transferencias
 *   apuntadas a mano (allí el destino lo eligió quien las apuntó).
 * - Las contrapartidas no cuentan como ingreso ni gasto (isTransferTx).
 * @returns {{ add: object[], update: { id: string, changes: object }[], remove: string[] }}
 */
export function planTransferSync(transactions, categories, subcategories, accounts) {
  const transferCatIds = new Set(categories.filter((c) => c.esTransferencia).map((c) => c.id))
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const byPair = new Map()
  for (const t of transactions) {
    if (!t.transferPairId) continue
    if (!byPair.has(t.transferPairId)) byPair.set(t.transferPairId, [])
    byPair.get(t.transferPairId).push(t)
  }
  const partnerOf = (t) => (t.transferPairId ? (byPair.get(t.transferPairId) ?? []).find((x) => x.id !== t.id) : null)
  const isManual = isManualTx

  const add = []
  const update = new Map()
  const remove = new Set()
  const claimed = new Set()
  const change = (t, changes) => update.set(t.id, { ...update.get(t.id), ...changes })

  for (const tx of transactions) {
    if (tx.esContrapartida) continue
    const partner = partnerOf(tx)
    if (partner && (!partner.esContrapartida || isManual(tx))) continue

    const dest = transferCatIds.has(tx.categoria) ? resolveTransferDestination(tx, categories, subcategories) : null
    const destAccount = dest && dest !== tx.accountId ? accountById.get(dest) : null

    if (partner && destAccount && partner.accountId === dest) {
      // Al día; solo se sigue al origen si cambió su importe o su fecha
      if (partner.importe !== -tx.importe || partner.fechaContable !== tx.fechaContable) {
        change(partner, { importe: -tx.importe, fechaContable: tx.fechaContable })
      }
      continue
    }
    if (partner) remove.add(partner.id) // destino quitado o cambiado
    if (!destAccount) {
      if (tx.transferPairId) change(tx, { transferPairId: null })
      continue
    }

    const pairId = newId()
    change(tx, { transferPairId: pairId })

    if (destAccount.tipo !== 'efectivo') {
      // A otro banco: el movimiento real de la cuenta destino, si ya está importado
      const date = new Date(tx.fechaContable).getTime()
      const match = transactions
        .filter((t) => t.accountId === dest && !t.transferPairId && !t.esContrapartida && !claimed.has(t.id) &&
          Math.abs(t.importe + tx.importe) <= 0.01 && Math.abs(new Date(t.fechaContable).getTime() - date) <= 3 * DAY_MS)
        .sort((a, b) => Math.abs(new Date(a.fechaContable).getTime() - date) - Math.abs(new Date(b.fechaContable).getTime() - date))[0]
      if (match) {
        claimed.add(match.id)
        change(match, { transferPairId: pairId, categoria: tx.categoria, subcategoria: tx.subcategoria || null })
        continue
      }
    }

    const origin = accountById.get(tx.accountId)?.nombre || 'otra cuenta'
    add.push({
      id: newId(),
      esManual: true,
      origen: 'manual',
      esContrapartida: true,
      fechaContable: tx.fechaContable,
      descripcion: tx.importe < 0 ? `Traspaso desde ${origin}` : `Traspaso a ${origin}`,
      notas: tx.descripcion || '',
      importe: -tx.importe,
      categoria: tx.categoria,
      subcategoria: tx.subcategoria || null,
      accountId: dest,
      transferPairId: pairId,
    })
  }

  // Contrapartidas cuyo movimiento de origen ya no existe
  for (const c of transactions) {
    if (c.esContrapartida && !partnerOf(c)) remove.add(c.id)
  }
  return { add, update: [...update].map(([id, changes]) => ({ id, changes })), remove: [...remove] }
}

/** «47 movimientos añadidos en su cuenta destino…» para avisar tras sincronizar (null si no hubo cambios). */
export function describeTransferSync({ created, linked, removed }) {
  const n = (count, one, many) => `${count} ${count === 1 ? one : many}`
  const parts = [
    created && `${n(created, 'movimiento añadido', 'movimientos añadidos')} en su cuenta destino`,
    linked && `${n(linked, 'emparejado', 'emparejados')} con su movimiento en la cuenta destino`,
    removed && `${n(removed, 'contrapartida quitada', 'contrapartidas quitadas')}`,
  ].filter(Boolean)
  return parts.length ? `Traspasos actualizados: ${parts.join(', ')}. No cuentan como ingreso ni gasto.` : null
}
