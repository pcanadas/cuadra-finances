import { describe, it, expect } from 'vitest'
import { evaluateGoals } from './goals'

const TODAY = new Date(2026, 9, 15) // octubre de 2026
const transferCatIds = new Set(['cat-transf'])
const ingresoCatIds = new Set(['cat-ingresos'])
let n = 0
const tx = (fecha, importe, extra = {}) => ({ id: `t${n++}`, fechaContable: fecha, importe, accountId: 'acc-1', ...extra })
// Traspaso del banco a la cuenta de ahorro: salida en el banco y entrada en la de ahorro
const toSavings = (fecha, importe, cuenta = 'acc-ahorro') => [
  tx(fecha, -importe, { categoria: 'cat-transf', transferPairId: `p${n}` }),
  tx(fecha, importe, { accountId: cuenta, categoria: 'cat-transf', transferPairId: `p${n}`, esContrapartida: true }),
]
const month = (ingresos, gastos, m) => [tx(`2026-${m}-01`, ingresos, { categoria: 'cat-ingresos' }), tx(`2026-${m}-10`, -gastos)]
const run = (goals, transactions) => evaluateGoals({ goals, transactions, transferCatIds, ingresoCatIds, today: TODAY })
const statuses = (r) => r.months.map((m) => m.status)

describe('ahorro a una cuenta', () => {
  const plan = { id: 'g1', tipo: 'ahorro', nombre: 'Colchón', importeMensual: 300, modo: 'cuenta', accountId: 'acc-ahorro', desde: '2026-07', creadoEn: '2026-07-01' }

  it('cada mes: conseguido, parcial o no conseguido según lo traspasado', () => {
    const { results } = run([plan], [...toSavings('2026-07-05', 300), ...toSavings('2026-08-05', 120), ...toSavings('2026-10-02', 100)])
    expect(statuses(results[0])).toEqual(['conseguido', 'parcial', 'no conseguido', 'en curso'])
    expect(results[0].months[1].contributed).toBe(120)
    expect(results[0].accumulated).toBe(520)
    expect(results[0].expected).toBe(1200)
  })

  it('este mes solo queda por apartar lo que falta por traspasar', () => {
    const { results, pendingThisMonth } = run([plan], toSavings('2026-10-02', 100))
    expect(results[0].current).toMatchObject({ quota: 300, contributed: 100, pending: 200 })
    expect(pendingThisMonth).toBe(200)
  })

  it('sacar dinero de la cuenta de ahorro resta', () => {
    const out = [tx('2026-08-20', -200, { accountId: 'acc-ahorro', categoria: 'cat-transf', transferPairId: 'x' })]
    const { results } = run([plan], [...toSavings('2026-07-05', 300), ...toSavings('2026-08-05', 300), ...out])
    expect(results[0].months[1]).toMatchObject({ contributed: 100, status: 'parcial' })
    expect(results[0].accumulated).toBe(400)
  })
})

describe('ahorro apartado (sin traspaso)', () => {
  const plan = { id: 'g1', tipo: 'ahorro', nombre: 'Futuro', importeMensual: 300, modo: 'apartado', desde: '2026-07', creadoEn: '2026-07-01' }

  it('cuenta lo que sobra del mes, hasta la cuota', () => {
    const txs = [...month(2000, 1500, '07'), ...month(2000, 1900, '08'), ...month(2000, 2100, '09')]
    const { results } = run([plan], txs)
    expect(statuses(results[0])).toEqual(['conseguido', 'parcial', 'no conseguido', 'en curso'])
    expect(results[0].months.map((m) => m.contributed)).toEqual([300, 100, 0, null])
    expect(results[0].accumulated).toBe(400)
  })

  it('el mes en curso se reserva entero', () => {
    expect(run([plan], month(2000, 100, '10')).pendingThisMonth).toBe(300)
  })

  it('lo traspasado a una cuenta de ahorro no vuelve a contar como sobrante', () => {
    const cuenta = { id: 'g0', tipo: 'ahorro', importeMensual: 300, modo: 'cuenta', accountId: 'acc-ahorro', desde: '2026-09', creadoEn: '2026-01-01' }
    const apartado = { ...plan, desde: '2026-09' }
    const { results } = run([cuenta, apartado], [...month(2000, 1500, '09'), ...toSavings('2026-09-20', 300)])
    expect(results[0].months[0].status).toBe('conseguido')
    expect(results[1].months[0]).toMatchObject({ contributed: 200, status: 'parcial' }) // 500 sobrantes − 300 traspasados
  })

  it('varios planes apartados se reparten el sobrante por orden de creación', () => {
    const a = { ...plan, id: 'a', creadoEn: '2026-01-01', desde: '2026-09' }
    const b = { ...plan, id: 'b', creadoEn: '2026-02-01', desde: '2026-09' }
    const { results } = run([b, a], month(2000, 1600, '09'))
    expect(results.map((r) => r.goal.id)).toEqual(['a', 'b'])
    expect(results.map((r) => r.months[0].contributed)).toEqual([300, 100])
  })
})

describe('metas', () => {
  const viaje = { id: 'm1', tipo: 'meta', nombre: 'Viaje', objetivo: 1200, fechaObjetivo: '2026-12', inicial: 0, modo: 'cuenta', accountId: 'acc-viaje', desde: '2026-07', creadoEn: '2026-07-01' }

  it('la cuota es lo que falta entre los meses que quedan y sube si un mes no se aporta', () => {
    const { results } = run([viaje], [...toSavings('2026-07-05', 200, 'acc-viaje'), ...toSavings('2026-09-05', 250, 'acc-viaje')])
    expect(results[0].months.map((m) => m.quota)).toEqual([200, 200, 250, 250])
    expect(statuses(results[0])).toEqual(['conseguido', 'no conseguido', 'conseguido', 'en curso'])
    expect(results[0].meta).toMatchObject({ remaining: 750, reached: false, monthsLeft: 3 })
  })

  it('cuenta lo que ya se tenía y se da por conseguida al llegar', () => {
    const { results, pendingThisMonth } = run([{ ...viaje, inicial: 1000 }], toSavings('2026-08-05', 200, 'acc-viaje'))
    expect(results[0].meta.reached).toBe(true)
    expect(results[0].months.at(-1).status).toBe('meta conseguida')
    expect(pendingThisMonth).toBe(0)
  })

  it('vencida sin llegar: pide todo lo que falta', () => {
    const { results } = run([{ ...viaje, fechaObjetivo: '2026-08' }], [])
    expect(results[0].meta.overdue).toBe(true)
    expect(results[0].current.quota).toBe(1200)
  })
})

describe('inicio', () => {
  it('sin fecha de inicio empieza el mes en que se creó; con una futura, aún no ha empezado', () => {
    const base = { tipo: 'ahorro', importeMensual: 100, modo: 'apartado' }
    const { results } = run([{ ...base, id: 'a', creadoEn: '2026-09-20T10:00:00Z' }, { ...base, id: 'b', creadoEn: '2026-10-01', desde: '2027-01' }], [])
    expect(results[0].months.map((m) => m.key)).toEqual(['2026-09', '2026-10'])
    expect(results[1]).toMatchObject({ started: false, current: null })
  })
})
