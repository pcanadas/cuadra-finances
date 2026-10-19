/**
 * Transfer pairing logic — when a transaction is categorised as an internal
 * transfer with a destination account, create or match its counterpart in the
 * destination account so the money flow is reflected on both sides.
 */

const DAY_MS = 86_400_000

// ── helpers ────────────────────────────────────────────────────────────────

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

  const pairId = `tp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

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
