import { describe, it, expect } from 'vitest'
import { resolveTransferDestination, findMatchingTransaction, isTransferTx, pairImportedTransfers } from './transferPairing'

const CATS = [
  { id: 'cat-t', nombre: 'Transferencias', esTransferencia: true, cuentaDestinoId: 'acc-2', palabrasClave: [] },
  { id: 'cat-t2', nombre: 'Transfer sin destino', esTransferencia: true, cuentaDestinoId: null, palabrasClave: [] },
]

const SUBCATS = [
  { id: 'sub-t1', categoriaId: 'cat-t', nombre: 'A efectivo', cuentaDestinoId: 'acc-3', palabrasClave: [] },
  { id: 'sub-t2', categoriaId: 'cat-t', nombre: 'Sin destino', cuentaDestinoId: null, palabrasClave: [] },
]

// ── resolveTransferDestination ─────────────────────────────────────────────

describe('resolveTransferDestination', () => {
  it('returns subcategory destination when present', () => {
    const tx = { categoria: 'cat-t', subcategoria: 'sub-t1' }
    expect(resolveTransferDestination(tx, CATS, SUBCATS)).toBe('acc-3')
  })

  it('falls back to category destination when subcategory has none', () => {
    const tx = { categoria: 'cat-t', subcategoria: 'sub-t2' }
    expect(resolveTransferDestination(tx, CATS, SUBCATS)).toBe('acc-2')
  })

  it('returns category destination when no subcategory', () => {
    const tx = { categoria: 'cat-t', subcategoria: null }
    expect(resolveTransferDestination(tx, CATS, SUBCATS)).toBe('acc-2')
  })

  it('returns null when no destination anywhere', () => {
    const tx = { categoria: 'cat-t2', subcategoria: null }
    expect(resolveTransferDestination(tx, CATS, SUBCATS)).toBeNull()
  })
})

// ── findMatchingTransaction ────────────────────────────────────────────────

describe('findMatchingTransaction', () => {
  const baseTx = { id: 'tx-1', importe: -100, fechaContable: '2026-10-15', accountId: 'acc-1' }

  const allTx = [
    baseTx,
    { id: 'tx-match', importe: 100, fechaContable: '2026-10-16', accountId: 'acc-2' },
    { id: 'tx-far', importe: 100, fechaContable: '2026-10-25', accountId: 'acc-2' },
    { id: 'tx-diff', importe: 50, fechaContable: '2026-10-15', accountId: 'acc-2' },
    { id: 'tx-neg', importe: -100, fechaContable: '2026-10-15', accountId: 'acc-2' },
    { id: 'tx-paired', importe: 100, fechaContable: '2026-10-15', accountId: 'acc-2', transferPairId: 'tp-existing' },
  ]

  it('finds matching income within tolerance', () => {
    const match = findMatchingTransaction(baseTx, allTx, 'acc-2', 3)
    expect(match.id).toBe('tx-match')
  })

  it('returns null when no match within tolerance', () => {
    const match = findMatchingTransaction(baseTx, allTx, 'acc-2', 0)
    expect(match).toBeNull()
  })

  it('ignores transactions with different amounts', () => {
    const tx = { ...baseTx, importe: -75 }
    expect(findMatchingTransaction(tx, allTx, 'acc-2', 30)).toBeNull()
  })

  it('ignores negative (expense) transactions in destination', () => {
    // tx-neg has same amount but negative — should not match
    const tx = { ...baseTx, fechaContable: '2026-10-15' }
    const match = findMatchingTransaction(tx, [allTx[0], allTx[4]], 'acc-2', 3)
    expect(match).toBeNull()
  })

  it('ignores already paired transactions', () => {
    const match = findMatchingTransaction(baseTx, [baseTx, allTx[5]], 'acc-2', 3)
    expect(match).toBeNull()
  })

  it('picks closest date when multiple matches', () => {
    const txs = [
      baseTx,
      { id: 'tx-day1', importe: 100, fechaContable: '2026-10-16', accountId: 'acc-2' },
      { id: 'tx-day0', importe: 100, fechaContable: '2026-10-15', accountId: 'acc-2' },
    ]
    const match = findMatchingTransaction(baseTx, txs, 'acc-2', 3)
    expect(match.id).toBe('tx-day0')
  })

  it('returns null for wrong destination account', () => {
    expect(findMatchingTransaction(baseTx, allTx, 'acc-99', 3)).toBeNull()
  })
})

describe('isTransferTx', () => {
  const ids = new Set(['cat-16'])
  it('counts transfer categories and paired movements as transfers', () => {
    expect(isTransferTx({ categoria: 'cat-16' }, ids)).toBe(true)
    expect(isTransferTx({ categoria: 'cat-15', transferPairId: 'tp-1' }, ids)).toBe(true)
    expect(isTransferTx({ categoria: 'cat-15' }, ids)).toBe(false)
  })
})

describe('pairImportedTransfers', () => {
  const ids = new Set(['cat-16'])
  const row = (id, accountId, importe, descripcion, categoria = 'cat-15', fechaContable = '2026-09-29') =>
    ({ id, accountId, importe, descripcion, categoria, fechaContable })

  it('pairs the outgoing transfer with the incoming side in the other account (multi-account statement)', () => {
    const out = pairImportedTransfers([
      row('a', 'acc-1', -1000, 'TRANSF INTERNA /Cuenta Ahorro', 'cat-16'),
      row('b', 'acc-1', -17.85, 'MERCADONA'),
      row('c', 'acc-3', 1000, 'TRANS /TITULAR'),
    ], ids, 'cat-16')
    expect(out[2].categoria).toBe('cat-16')               // ya no es «Otros» → no cuenta como ingreso
    expect(out[0].transferPairId).toBeTruthy()
    expect(out[2].transferPairId).toBe(out[0].transferPairId)
    expect(out[1].transferPairId).toBeUndefined()
  })

  it('does not pair movements in the same account or unrelated ones', () => {
    const out = pairImportedTransfers([
      row('a', 'acc-1', -50, 'TRANSF A JUAN'),
      row('b', 'acc-1', 50, 'TRANSF DE JUAN'),             // misma cuenta
      row('c', 'acc-3', -20, 'COMPRA'),
      row('d', 'acc-1', 20, 'DEVOLUCION'),                  // nada indica traspaso
      row('e', 'acc-3', 70, 'TRASPASO', 'cat-15', '2026-10-10'), // demasiado lejos
      row('f', 'acc-1', -70, 'TRASPASO', 'cat-15', '2026-09-29'),
    ], ids, 'cat-16')
    expect(out.every((t) => !t.transferPairId)).toBe(true)
  })
})
