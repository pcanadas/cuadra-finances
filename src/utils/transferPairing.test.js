import { describe, it, expect } from 'vitest'
import { resolveTransferDestination, findMatchingTransaction } from './transferPairing'

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
