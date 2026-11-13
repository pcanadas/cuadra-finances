import { describe, it, expect } from 'vitest'
import { sortChrono } from './txOrder'

const tx = (id, fecha, importe, saldo, extra = {}) => ({ id, fechaContable: fecha, descripcion: id, importe, saldo, accountId: 'acc-1', ...extra })
const ids = (list) => list.map((t) => t.id)

describe('sortChrono', () => {
  it('orders a day by the balance chain even across imports', () => {
    // Dos importaciones distintas del mismo día; los ids no dicen nada del orden real
    const list = [
      tx('cafe', '2026-11-12', -14.55, 625.1, { importId: 1, bankRowIndex: 0 }),
      tx('barbero', '2026-11-12', -9, 639.65, { importId: 1, bankRowIndex: 1 }),
      tx('tienda2', '2026-11-12', -66.93, 648.65, { importId: 2, bankRowIndex: 3 }),
      tx('bizum', '2026-11-12', -15, 857.04, { importId: 2, bankRowIndex: 9 }),
      tx('tienda1', '2026-11-12', -208.39, 648.65 + 66.93, { importId: 2, bankRowIndex: 5 }),
      tx('ayer', '2026-11-11', -10, 857.04 + 15, { importId: 1, bankRowIndex: 7 }),
    ]
    expect(ids(sortChrono(list))).toEqual(['ayer', 'bizum', 'tienda1', 'tienda2', 'barbero', 'cafe'])
  })

  it('without balances follows the statement, newest-first files reversed', () => {
    // Extracto con lo más reciente primero (fila 0 = 3 nov)
    const newestFirst = [
      tx('c', '2026-11-03', -1, null, { importId: 5, bankRowIndex: 0 }),
      tx('b', '2026-11-01', -1, null, { importId: 5, bankRowIndex: 1 }),
      tx('a', '2026-11-01', -1, null, { importId: 5, bankRowIndex: 2 }),
    ]
    expect(ids(sortChrono(newestFirst))).toEqual(['a', 'b', 'c'])
    // Extracto con lo más antiguo primero
    const oldestFirst = [
      tx('a', '2026-11-01', -1, null, { importId: 6, bankRowIndex: 0 }),
      tx('b', '2026-11-01', -1, null, { importId: 6, bankRowIndex: 1 }),
      tx('c', '2026-11-03', -1, null, { importId: 6, bankRowIndex: 2 }),
    ]
    expect(ids(sortChrono(oldestFirst))).toEqual(['a', 'b', 'c'])
  })

  it('puts pendings (no balance) at the end of their day', () => {
    const list = [
      tx('pend', '2026-11-12', -5, null, { pendiente: true, importId: 2, bankRowIndex: 0 }),
      tx('x', '2026-11-12', -1, 99, { importId: 2, bankRowIndex: 1 }),
      tx('y', '2026-11-12', -1, 98, { importId: 2, bankRowIndex: 2 }),
    ]
    expect(ids(sortChrono(list))).toEqual(['x', 'y', 'pend'])
  })

  it('keeps accounts apart', () => {
    const list = [
      tx('a2', '2026-11-12', -1, 49, { accountId: 'acc-2' }),
      tx('a1', '2026-11-12', -1, 99),
      tx('a1b', '2026-11-12', -1, 98),
    ]
    const sorted = sortChrono(list)
    expect(ids(sorted.filter((t) => t.accountId === 'acc-1'))).toEqual(['a1', 'a1b'])
  })
})
