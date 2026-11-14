import { describe, it, expect } from 'vitest'
import { makeShare, rescaleShare, forStats, sharedItems, refundItems, sharedSummary, knownPeople, isSharedTx } from './shared'

const tx = (id, importe, extra = {}) => ({ id, fechaContable: '2026-11-10', descripcion: id, importe, categoria: 'cat-1', accountId: 'acc-1', ...extra })

describe('makeShare', () => {
  it('splits by percentage, keeping the sign', () => {
    expect(makeShare({ importe: -100, pct: 50, con: ' Eric ' })).toEqual({ miParte: -50, pct: 50, con: 'Eric' })
    expect(makeShare({ importe: -80, pct: 25 }).miParte).toBe(-20)
  })
  it('takes a fixed amount without going over the total', () => {
    expect(makeShare({ importe: -60, miParte: 15 })).toEqual({ miParte: -15, pct: null, con: '' })
    expect(makeShare({ importe: -60, miParte: 90 }).miParte).toBe(-60)
  })
  it('all for the other person is 0', () => {
    expect(makeShare({ importe: -40, pct: 0 }).miParte).toBe(-0)
  })
  it('rescales when the amount changes', () => {
    expect(rescaleShare({ miParte: -50, pct: 50, con: 'Eric' }, -120).miParte).toBe(-60)
    expect(rescaleShare({ miParte: -30, pct: null, con: '' }, -20).miParte).toBe(-20)
  })
})

describe('forStats', () => {
  it('counts only my part and leaves refunds out', () => {
    const list = [
      tx('super', -100, { compartido: { miParte: -50, pct: 50, con: 'Eric' } }),
      tx('bizum', 50, { categoria: 'cat-14', reembolso: { de: 'Eric' } }),
      tx('cafe', -3),
    ]
    const stats = forStats(list)
    expect(stats.map((t) => [t.id, t.importe])).toEqual([['super', -50], ['cafe', -3]])
    expect(stats[0].importeTotal).toBe(-100)
  })
  it('works on the parts of a split', () => {
    const amazon = tx('amazon', -90, { categoria: null, desglose: [
      { importe: -60, categoria: 'cat-1', compartido: { miParte: -30, pct: 50, con: 'Eric' } },
      { importe: -30, categoria: 'cat-5' },
    ] })
    expect(isSharedTx(amazon)).toBe(true)
    expect(forStats([amazon]).map((t) => t.importe)).toEqual([-30, -30])
  })
  it('leaves untouched lists as they are', () => {
    const list = [tx('a', -1)]
    expect(forStats(list)).toBe(list)
  })
})

describe('summary', () => {
  it('adds up what I paid, my part, what I advanced and what came back, per person', () => {
    const list = [
      tx('super', -100, { compartido: { miParte: -50, pct: 50, con: 'Eric' } }),
      tx('cena', -80, { compartido: { miParte: -20, pct: 25, con: 'Eric' } }),
      tx('regalo', -30, { compartido: { miParte: 0, pct: 0, con: 'Ana' } }),
      tx('bizum', 70, { reembolso: { de: 'Eric' } }),
    ]
    const s = sharedSummary(sharedItems(list), refundItems(list))
    expect(s).toMatchObject({ pagado: 210, miParte: 70, otros: 140, devuelto: 70 })
    expect(s.personas).toEqual([
      { nombre: 'Ana', adelantado: 30, devuelto: 0 },
      { nombre: 'Eric', adelantado: 110, devuelto: 70 },
    ])
    expect(knownPeople(list)).toEqual(['Ana', 'Eric'])
  })
})
