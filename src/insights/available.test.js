import { describe, it, expect } from 'vitest'
import { availableToSpend } from './available'
import { isDueInMonth, findFixedPayment } from './fixedItems'

const TODAY = new Date(2026, 9, 11) // 11 de octubre de 2026: quedan 21 días contando hoy
const transferCatIds = new Set(['cat-transf'])
const ingresoCatIds = new Set(['cat-ingresos'])
const tx = (fecha, importe, extra = {}) => ({ id: `${fecha}-${importe}-${Math.random()}`, fechaContable: fecha, importe, descripcion: '', ...extra })
const run = (transactions, recurringItems = []) => availableToSpend({ transactions, transferCatIds, ingresoCatIds, recurringItems, today: TODAY })

const NOMINAS = [tx('2026-07-28', 2000, { categoria: 'cat-ingresos' }), tx('2026-08-28', 2000, { categoria: 'cat-ingresos' }), tx('2026-09-28', 2300, { categoria: 'cat-ingresos' })]

describe('availableToSpend', () => {
  it('sin ingresos fijos usa la media de los últimos meses si aún no ha llegado la nómina', () => {
    const r = run([...NOMINAS, tx('2026-10-02', -300, { categoria: 'cat-super' }), tx('2026-10-05', -120)])
    expect(r.income).toMatchObject({ basis: 'media', average: 2100, received: 0, months: 3 })
    expect(r.spent).toBe(420)
    expect(r.total).toBe(1680)
    expect(r.daysLeft).toBe(21)
    expect(r.perDay).toBe(80)
  })

  it('cuando ya se ha cobrado más que la media, usa lo recibido', () => {
    const r = run([...NOMINAS, tx('2026-10-01', 2500, { categoria: 'cat-ingresos' }), tx('2026-10-03', -500)])
    expect(r.income.basis).toBe('recibidos')
    expect(r.total).toBe(2000)
  })

  it('con ingresos fijos cuenta lo recibido y lo pendiente, y resta los gastos fijos sin pagar', () => {
    const fijos = [
      { id: 'n', nombre: 'Nómina', importe: 2000, categoriaId: 'cat-ingresos', periodicidad: 'mensual', activo: true },
      { id: 'a', nombre: 'Alquiler', importe: 700, categoriaId: 'cat-vivienda', periodicidad: 'mensual', activo: true },
      { id: 'g', nombre: 'Gimnasio', importe: 30, categoriaId: 'cat-deporte', periodicidad: 'mensual', activo: true },
      { id: 's', nombre: 'Seguro', importe: 400, categoriaId: 'cat-seguro', periodicidad: 'anual', mesReferencia: 2, activo: true }, // marzo: no toca
    ]
    const r = run([...NOMINAS, tx('2026-10-01', -700, { categoria: 'cat-vivienda' }), tx('2026-10-04', -50)], fijos)
    expect(r.income).toMatchObject({ basis: 'fijos', received: 0, pendingFixed: 2000, expected: 2000 })
    expect(r.spent).toBe(750)
    expect(r.pendingFixed).toBe(30) // el alquiler ya está pagado
    expect(r.pendingFixedCount).toBe(1)
    expect(r.total).toBe(1220)
  })

  it('no cuenta los traspasos entre cuentas propias', () => {
    const r = run([...NOMINAS, tx('2026-10-02', -200, { categoria: 'cat-transf' }), tx('2026-10-02', 200, { transferPairId: 'p', esContrapartida: true })])
    expect(r.spent).toBe(0)
    expect(r.income.received).toBe(0)
  })

  it('si ya se ha gastado más de lo previsto, el total es negativo y no hay importe por día', () => {
    const r = run([...NOMINAS, tx('2026-10-02', -2500)])
    expect(r.total).toBe(-400)
    expect(r.perDay).toBe(0)
  })

  it('sin historial suficiente ni ingresos este mes no hay media', () => {
    const r = run([tx('2026-09-10', 1000), tx('2026-10-02', -100)])
    expect(r.income).toMatchObject({ basis: 'recibidos', average: null, expected: 0 })
    expect(r.total).toBe(-100)
  })

  it('sin movimientos ni historial no devuelve nada', () => {
    expect(run([])).toBeNull()
  })

  it('ignora movimientos futuros', () => {
    const r = run([...NOMINAS, tx('2026-11-01', -999)])
    expect(r.spent).toBe(0)
  })
})

describe('fijos', () => {
  it('isDueInMonth según periodicidad y mes de referencia', () => {
    expect(isDueInMonth({ periodicidad: 'mensual' }, 5)).toBe(true)
    expect(isDueInMonth({ periodicidad: 'trimestral', mesReferencia: 1 }, 4)).toBe(true)
    expect(isDueInMonth({ periodicidad: 'trimestral', mesReferencia: 1 }, 5)).toBe(false)
    expect(isDueInMonth({ periodicidad: 'anual', mesReferencia: 11 }, 11)).toBe(true)
  })

  it('findFixedPayment busca por nombre si no tiene categoría, con importe parecido', () => {
    const item = { nombre: 'Netflix mensual', importe: 13 }
    expect(findFixedPayment(item, [tx('2026-10-03', -12.99, { descripcion: 'NETFLIX.COM MENSUAL' })], false)).not.toBeNull()
    expect(findFixedPayment(item, [tx('2026-10-03', -30, { descripcion: 'NETFLIX.COM MENSUAL' })], false)).toBeNull()
  })
})
