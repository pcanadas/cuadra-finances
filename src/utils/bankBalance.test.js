import { describe, it, expect } from 'vitest'
import { balanceHistory, checkBalances, findDuplicates, findStalePending, planImport } from './bankBalance'

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

  // Pendiente con la fecha en el concepto; contabilizado días después con una referencia
  const pend = (id, fecha, descripcion, importe) => ({ id, fechaContable: fecha, descripcion, importe, saldo: null, pendiente: true, accountId: 'acc-1' })
  const book = (id, fecha, descripcion, importe, saldo) => ({ id, fechaContable: fecha, descripcion, importe, saldo, accountId: 'acc-1' })

  it('completes a pending whose text only shares the merchant (date vs. reference)', () => {
    const pending = pend('p1', '2026-11-09', 'WWW.TIENDA           08/11/26', -66.93)
    const booked = book('b1', '2026-11-12', 'WWW.TIENDA*AB6WF8XY4', -66.93, 900)
    const { add, update } = planImport([pending], [booked], 'acc-1')
    expect(add).toEqual([])
    expect(update[0]).toMatchObject({ id: 'p1', changes: { saldo: 900, descripcion: 'WWW.TIENDA*AB6WF8XY4', pendiente: false } })
  })

  it('does not add again a pending the bank keeps listing after booking it', () => {
    const pending = pend('p1', '2026-11-12', 'CAFETERIA LUNA 12/11/26', -1.9)
    // El extracto nuevo trae el contabilizado y, en pendientes, la misma compra todavía
    const incoming = [pend('n0', '2026-11-12', 'CAFETERIA LUNA 12/11/26', -1.9), book('n1', '2026-11-13', 'CAFETERIA LUNA', -1.9, 500)]
    const { add, update } = planImport([pending], incoming, 'acc-1')
    expect(add).toEqual([])
    expect(update).toHaveLength(1)
    // Y en una importación posterior, con el contabilizado ya guardado, tampoco
    const saved = [{ ...pending, ...update[0].changes }]
    expect(planImport(saved, [pend('m0', '2026-11-12', 'CAFETERIA LUNA 12/11/26', -1.9)], 'acc-1').add).toEqual([])
  })

  it('still adds a genuinely new pending', () => {
    const booked = book('b1', '2026-11-10', 'CAFETERIA LUNA', -1.9, 500) // anterior: no puede ser el mismo
    const fresh = pend('n0', '2026-11-12', 'CAFETERIA LUNA 12/11/26', -1.9)
    expect(planImport([booked], [fresh], 'acc-1').add).toEqual([fresh])
    // Dos pendientes iguales y un solo contabilizado: uno queda pendiente
    const two = [pend('n1', '2026-11-12', 'CAFETERIA LUNA 12/11/26', -1.9), pend('n2', '2026-11-12', 'CAFETERIA LUNA 12/11/26', -1.9)]
    expect(planImport([book('b2', '2026-11-13', 'CAFETERIA LUNA', -1.9, 400)], two, 'acc-1').add).toHaveLength(1)
  })

  it('never matches a booked movement dated before the pending one', () => {
    const pending = pend('p1', '2026-11-12', 'WWW.TIENDA 12/11/26', -20)
    const earlier = book('b1', '2026-11-10', 'WWW.TIENDA*AB12', -20, 300)
    expect(planImport([pending], [earlier], 'acc-1').update).toEqual([])
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

describe('balanceHistory', () => {
  const manual = (fecha, importe, n) => ({ id: `tx-manual-${n}-x`, fechaContable: fecha, descripcion: 'A MANO', importe, saldo: null, accountId: 'acc-1' })
  const sort = (list) => [...list].sort((a, b) => a.fechaContable.localeCompare(b.fechaContable))

  it('computes earlier movements backwards from the first bank balance', () => {
    const bank = statement(1, 100, MOVES) // saldo antes del primero: 100
    const all = sort([manual('2026-09-10', 30, 1), manual('2026-09-20', -10, 2), ...bank])
    const { series, calculated } = balanceHistory(all, checkBalances(all).withBalance)
    expect(calculated).toBe(2)
    expect(series.map((t) => t.saldo).slice(0, 3)).toEqual([110, 100, 2100])
  })

  it('leaves the bank balances untouched and ignores manual movements after the first statement', () => {
    const bank = statement(1, 100, MOVES)
    const all = sort([...bank, manual('2026-10-03', -20, 1)])
    const { series, calculated } = balanceHistory(all, checkBalances(all).withBalance)
    expect(calculated).toBe(0)
    expect(series).toEqual(bank)
  })

  it('is empty without bank balances', () => {
    const all = [manual('2026-09-10', 30, 1)]
    expect(balanceHistory(all, checkBalances(all).withBalance)).toEqual({ series: [], calculated: 0 })
  })
})

describe('findStalePending', () => {
  const pend = (id, fecha, descripcion, importe) => ({ id, fechaContable: fecha, descripcion, importe, saldo: null, pendiente: true, accountId: 'acc-1' })
  const book = (id, fecha, descripcion, importe, saldo) => ({ id, fechaContable: fecha, descripcion, importe, saldo, accountId: 'acc-1' })

  it('finds pendings that were already booked (duplicates from earlier imports)', () => {
    const txs = [
      pend('p1', '2026-11-09', 'WWW.TIENDA           08/11/26', -66.93),
      book('b1', '2026-11-12', 'WWW.TIENDA*AB6WF8XY4', -66.93, 900),
      pend('p2', '2026-11-12', 'CAFETERIA LUNA 12/11/26', -1.9),
      book('b2', '2026-11-13', 'CAFETERIA LUNA', -1.9, 898.1),
      pend('p3', '2026-11-13', 'OTRA TIENDA 13/11/26', -5), // aún pendiente de verdad
    ]
    const groups = findStalePending(txs)
    expect(groups.map((g) => [g.remove[0].id, g.keep[0].id])).toEqual([['p1', 'b1'], ['p2', 'b2']])
  })

  it('also finds old pendings saved with balance 0 (before 0.8.0)', () => {
    const legacy = { id: 'old', fechaContable: '2026-10-26', descripcion: 'WWW.TIENDA 25/10/26', importe: -14.13, saldo: 0, accountId: 'acc-1' }
    const booked = book('b', '2026-10-28', 'WWW.TIENDA*XY21F87E14', -14.13, 900)
    expect(findStalePending([legacy, booked]).map((g) => g.remove[0].id)).toEqual(['old'])
    // Sin contabilizado que case, no se toca
    expect(findStalePending([legacy])).toEqual([])
  })
})

describe('pending matching with repeated purchases', () => {
  const pend = (id, fecha, descripcion, importe) => ({ id, fechaContable: fecha, descripcion, importe, saldo: null, pendiente: true, accountId: 'acc-1' })
  const book = (id, fecha, descripcion, importe, saldo) => ({ id, fechaContable: fecha, descripcion, importe, saldo, accountId: 'acc-1' })

  it('pairs each booked movement with the closest pending (daily coffee)', () => {
    const pendings = [pend('p10', '2026-11-10', 'CAFETERIA LUNA 10/11/26', -1.9), pend('p12', '2026-11-12', 'CAFETERIA LUNA 12/11/26', -1.9)]
    const { add, update } = planImport(pendings, [book('b13', '2026-11-13', 'CAFETERIA LUNA', -1.9, 500)], 'acc-1')
    expect(add).toEqual([])
    expect(update.map((u) => u.id)).toEqual(['p12'])
  })

  it('matches a booking up to 10 days later, not more', () => {
    expect(planImport([pend('p', '2026-11-06', 'WWW.TIENDA 06/11/26', -84.95)], [book('b', '2026-11-12', 'WWW.TIENDA* XY44469X4', -84.95, 1)], 'acc-1').add).toEqual([])
    expect(planImport([pend('p', '2026-11-01', 'WWW.TIENDA 01/11/26', -84.95)], [book('b', '2026-11-12', 'WWW.TIENDA*XY4', -84.95, 1)], 'acc-1').add).toHaveLength(1)
  })
})
