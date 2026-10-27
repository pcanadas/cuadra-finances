import { describe, it, expect } from 'vitest'
import { checkBalances, findDuplicates, planImport } from './bankBalance'

// Extracto encadenado: cada movimiento parte del saldo del anterior
function statement(importId, start, moves, firstIndex = 0) {
  let saldo = start
  return moves.map(([fecha, descripcion, importe], i) => {
    saldo = Math.round((saldo + importe) * 100) / 100
    return { id: `tx-${importId}-${firstIndex + i}-x`, importId, fechaContable: fecha, descripcion, importe, saldo, accountId: 'acc-1' }
  })
}

const MOVES = [
  ['2026-10-01', 'NOMINA', 2000],
  ['2026-10-02', 'MERCADONA', -45.3],
  ['2026-10-02', 'CAFE', -1.5],
  ['2026-10-02', 'CAFE', -1.5], // dos cafés iguales el mismo día: son reales
  ['2026-10-05', 'ALQUILER', -750],
]

describe('checkBalances', () => {
  it('a complete statement has no issues, whatever the order', () => {
    const txs = statement(1, 100, MOVES)
    expect(checkBalances(txs).issues).toEqual([])
    expect(checkBalances([...txs].reverse()).issues).toEqual([])
  })

  it('flags the movement right after a missing one', () => {
    const txs = statement(1, 100, MOVES).filter((t) => t.descripcion !== 'MERCADONA')
    const { issues } = checkBalances(txs)
    expect(issues.map((t) => t.descripcion)).toEqual(['CAFE'])
  })

  it('ignores movements without saldo and pending ones', () => {
    const txs = [...statement(1, 100, MOVES), { id: 'tx-manual-1', fechaContable: '2026-10-03', descripcion: 'Taxi', importe: -12 },
      { id: 'tx-2-0-x', fechaContable: '2026-10-06', descripcion: 'COMPRA', importe: -9, saldo: null, pendiente: true }]
    const r = checkBalances(txs)
    expect(r.issues).toEqual([])
    expect(r.pending.map((t) => t.descripcion)).toEqual(['COMPRA'])
  })

  it('treats a legacy saldo 0 that fits nothing as pending, not as a real balance', () => {
    const txs = [...statement(1, 100, MOVES), { id: 'tx-2-0-x', fechaContable: '2026-10-06', descripcion: 'COMPRA', importe: -9, saldo: 0 }]
    const r = checkBalances(txs)
    expect(r.issues).toEqual([])
    expect(r.pending).toHaveLength(1)
    expect(r.withBalance).toHaveLength(MOVES.length)
  })

  it('finds the previous movement in sparse accounts (months apart)', () => {
    const txs = statement(1, 0, [['2025-01-10', 'A', 100], ['2025-04-10', 'B', -20], ['2025-09-01', 'C', 50]])
    expect(checkBalances(txs).issues).toEqual([])
  })
})

describe('findDuplicates', () => {
  it('detects the same movement imported from two overlapping statements', () => {
    const first = statement(1000, 100, MOVES.slice(0, 2))
    // Segundo extracto del mismo día: la nómina vuelve a venir, con otro saldo provisional
    const second = statement(90000, 50, MOVES.slice(0, 1))
    const groups = findDuplicates([...first, ...second])
    expect(groups).toHaveLength(1)
    expect(groups[0].keep).toEqual([second[0]]) // se queda la importación más reciente
    expect(groups[0].remove).toEqual([first[0]])
  })

  it('keeps identical movements that come in the same statement', () => {
    expect(findDuplicates(statement(1000, 100, MOVES))).toEqual([])
  })

  it('keeps as many copies as the statement with most of them', () => {
    const a = statement(1000, 100, [['2026-10-02', 'CAFE', -1.5]])
    const b = statement(90000, 100, [['2026-10-02', 'CAFE', -1.5], ['2026-10-02', 'CAFE', -1.5]])
    const [g] = findDuplicates([...a, ...b])
    expect(g.keep).toHaveLength(2)
    expect(g.remove).toEqual(a)
  })

  it('never touches manual movements', () => {
    const manual = { id: 'tx-manual-1', fechaContable: '2026-10-01', descripcion: 'NOMINA', importe: 2000 }
    expect(findDuplicates([...statement(1000, 100, MOVES), manual])).toEqual([])
  })
})

describe('planImport', () => {
  it('does not duplicate an overlapping statement and keeps real same-day repeats', () => {
    const existing = statement(1000, 100, MOVES.slice(0, 3))
    const incoming = statement(90000, 100, MOVES)
    const { add, update } = planImport(existing, incoming, 'acc-1')
    expect(add.map((t) => t.descripcion)).toEqual(['CAFE', 'ALQUILER'])
    expect(update).toEqual([])
  })

  it('re-importing the same file adds nothing', () => {
    const txs = statement(1000, 100, MOVES)
    expect(planImport(txs, statement(90000, 100, MOVES), 'acc-1')).toEqual({ add: [], update: [] })
  })

  it('takes the final saldo when a movement comes back with another one', () => {
    const existing = statement(1000, 100, MOVES.slice(0, 1))
    const incoming = statement(90000, 300, MOVES.slice(0, 1))
    const { add, update } = planImport(existing, incoming, 'acc-1')
    expect(add).toEqual([])
    expect(update).toEqual([{ id: existing[0].id, changes: expect.objectContaining({ saldo: 2300, pendiente: false }) }])
  })

  it('completes a pending movement once the bank books it (other date, similar text)', () => {
    const pending = { id: 'tx-1000-0-x', fechaContable: '2026-10-26', descripcion: 'COMPRA TARJ. AMAZON', importe: -20, saldo: null, pendiente: true, categoria: 'cat-x', accountId: 'acc-1' }
    const booked = { id: 'tx-90000-0-x', fechaContable: '2026-10-28', descripcion: 'COMPRA TARJ. AMAZON EU', importe: -20, saldo: 480, accountId: 'acc-1' }
    const { add, update } = planImport([pending], [booked], 'acc-1')
    expect(add).toEqual([])
    expect(update[0]).toEqual({ id: pending.id, changes: expect.objectContaining({ saldo: 480, fechaContable: '2026-10-28', pendiente: false }) })
    expect(update[0].changes.categoria).toBeUndefined() // conserva su categoría
  })

  it('does not merge different movements just because they look alike', () => {
    const pending = { id: 'tx-1000-0-x', fechaContable: '2026-10-01', descripcion: 'BIZUM ANA', importe: -10, saldo: null, pendiente: true, accountId: 'acc-1' }
    const later = { id: 'tx-90000-0-x', fechaContable: '2026-10-20', descripcion: 'BIZUM ANA', importe: -10, saldo: 90, accountId: 'acc-1' }
    expect(planImport([pending], [later], 'acc-1').add).toEqual([later])
  })

  it('compares per account (legacy movements without account belong to the default one)', () => {
    const legacy = statement(1000, 100, MOVES.slice(0, 1)).map(({ accountId, ...t }) => t) // eslint-disable-line no-unused-vars
    const other = statement(90000, 100, MOVES.slice(0, 1)).map((t) => ({ ...t, accountId: 'acc-2' }))
    expect(planImport(legacy, other, 'acc-1').add).toHaveLength(1)
    expect(planImport(legacy, statement(90000, 100, MOVES.slice(0, 1)), 'acc-1').add).toHaveLength(0)
  })
})
