import { describe, it, expect } from 'vitest'
import {
  equalParts, makeShare, shareAddsUp, rescaleShare, shareOf, paymentOf, forStats, ledger, peopleSummary,
  monthlyBalance, spendingByCategory, knownNames, isSharedTx,
} from './shared'

const tx = (id, importe, extra = {}) => ({ id, fechaContable: '2026-11-10', descripcion: id, importe, categoria: 'cat-1', accountId: 'acc-1', ...extra })

describe('repartos', () => {
  it('equalParts cuadra los céntimos', () => {
    expect(equalParts(100, 3)).toEqual([33.33, 33.33, 33.34])
  })
  it('a partes iguales entre tú y varias personas', () => {
    const s = makeShare({ importe: -300, modo: 'iguales', nombres: ['Pablo', 'Manuel'], partida: ' Viaje ' })
    expect(s.miParte).toBe(-100)
    expect(s.personas).toEqual([{ nombre: 'Pablo', importe: 100 }, { nombre: 'Manuel', importe: 100 }])
    expect(s.partida).toBe('Viaje')
    expect(shareAddsUp(s, -300)).toBe(true)
  })
  it('con una persona, a medias es el 50 %', () => {
    expect(makeShare({ importe: -80, modo: 'iguales', nombres: ['Pablo'] })).toMatchObject({ miParte: -40, pct: 50 })
  })
  it('por porcentaje, por importe, nada, o a mano', () => {
    expect(makeShare({ importe: -80, modo: 'pct', pct: 25, nombres: ['Pablo'] }).personas[0].importe).toBe(60)
    expect(makeShare({ importe: -60, modo: 'importe', miParte: 90, nombres: ['Pablo'] }).miParte).toBe(-60)
    expect(makeShare({ importe: -40, modo: 'nada', nombres: ['Pablo'] }).personas[0].importe).toBe(40)
    const manual = makeShare({ importe: -100, modo: 'importe', miParte: 20, nombres: ['Pablo', 'Manuel'], otros: [50, 30] })
    expect(shareAddsUp(manual, -100)).toBe(true)
    expect(shareAddsUp({ ...manual, personas: [{ nombre: 'Pablo', importe: 10 }] }, -100)).toBe(false)
  })
  it('rescala en proporción si cambia el importe', () => {
    const s = rescaleShare(makeShare({ importe: -100, modo: 'iguales', nombres: ['Pablo'] }), -120)
    expect(s.miParte).toBe(-60)
    expect(s.personas[0].importe).toBe(60)
  })
  it('lee el formato de la primera prueba', () => {
    expect(shareOf({ importe: -100, compartido: { miParte: -50, pct: 50, con: 'Pablo' } }).personas).toEqual([{ nombre: 'Pablo', importe: 50 }])
    expect(paymentOf({ importe: 50, reembolso: { de: 'Pablo' } })).toMatchObject({ persona: 'Pablo', sentido: 'recibido' })
  })
})

describe('forStats', () => {
  it('cuenta solo tu parte, quita los pagos entre personas y añade tus apuntes con categoría', () => {
    const list = [
      tx('super', -100, { compartido: makeShare({ importe: -100, nombres: ['Pablo'] }) }),
      tx('bizum', 50, { categoria: 'cat-ti', pagoPersona: { persona: 'Pablo', sentido: 'recibido' } }),
      tx('pagoPablo', -40, { pagoPersona: { persona: 'Pablo', sentido: 'enviado' } }),
      tx('cafe', -3),
    ]
    const apuntes = [
      { id: 'a1', fecha: '2026-11-12', descripcion: 'Cena (pagó Pablo)', importe: 80, pagadoPor: 'Pablo', miParte: 40, categoria: 'cat-2' },
      { id: 'a2', fecha: '2026-11-12', descripcion: 'Préstamo', importe: 200, pagadoPor: 'Pablo', miParte: 200, categoria: null },
    ]
    expect(forStats(list, apuntes).map((t) => [t.id, t.importe])).toEqual([['super', -50], ['cafe', -3], ['apunte:a1', -40]])
  })
  it('funciona en las partidas de un desglose', () => {
    const amazon = tx('amazon', -90, { categoria: null, desglose: [
      { importe: -60, categoria: 'cat-1', compartido: makeShare({ importe: -60, nombres: ['Pablo'] }) },
      { importe: -30, categoria: 'cat-5' },
    ] })
    expect(isSharedTx(amazon)).toBe(true)
    expect(forStats([amazon]).map((t) => t.importe)).toEqual([-30, -30])
  })
  it('deja igual una lista sin nada compartido', () => {
    const list = [tx('a', -1)]
    expect(forStats(list)).toBe(list)
  })
})

describe('cuentas con cada persona', () => {
  const list = [
    tx('hotel', -300, { fechaContable: '2026-10-05', compartido: makeShare({ importe: -300, nombres: ['Pablo', 'Manuel'], partida: 'Viaje' }) }),
    tx('super', -100, { fechaContable: '2026-11-03', compartido: makeShare({ importe: -100, nombres: ['Pablo'] }) }),
    tx('bizum', 70, { fechaContable: '2026-11-10', pagoPersona: { persona: 'Pablo', sentido: 'recibido', partida: 'Viaje' } }),
    tx('regalo', -30, { fechaContable: '2026-11-11', compartido: makeShare({ importe: -30, modo: 'nada', nombres: ['Manuel'], partida: 'Regalo' }) }),
  ]
  const apuntes = [
    { id: 'a1', fecha: '2026-11-12', descripcion: 'Cena', importe: 80, pagadoPor: 'Pablo', miParte: 40, categoria: 'cat-2', partida: '' },
  ]
  const entries = ledger(list, apuntes)

  it('saldo por persona y por partida', () => {
    const people = peopleSummary(entries)
    const pablo = people.find((p) => p.nombre === 'Pablo')
    // 100 (hotel) + 50 (súper) − 70 (Bizum) − 40 (cena que pagó él) = 40
    expect(pablo).toMatchObject({ saldo: 40, adelantado: 150, recibido: 70, debido: 40 })
    expect(pablo.partidas).toEqual([{ nombre: 'Viaje', saldo: 30 }, { nombre: '', saldo: 10 }])
    const manuel = people.find((p) => p.nombre === 'Manuel')
    expect(manuel.saldo).toBe(130)
    expect(manuel.partidas).toEqual([{ nombre: 'Regalo', saldo: 30 }, { nombre: 'Viaje', saldo: 100 }])
  })
  it('un pago que haces aumenta lo que te deben (o salda lo que debes)', () => {
    const e = ledger([tx('pago', -40, { pagoPersona: { persona: 'Pablo', sentido: 'enviado' } })])
    expect(e[0].efecto).toBe(40)
  })
  it('saldo mes a mes y gasto por categoría', () => {
    const pablo = entries.filter((e) => e.persona === 'Pablo')
    expect(monthlyBalance(pablo)).toEqual([{ mes: '2026-10', cambio: 100, saldo: 100 }, { mes: '2026-11', cambio: -60, saldo: 40 }])
    expect(spendingByCategory(pablo)[0]).toEqual({ categoria: 'cat-1', total: 400, suParte: 150 })
  })
  it('nombres y partidas usados', () => {
    expect(knownNames(entries)).toEqual({ personas: ['Manuel', 'Pablo'], partidas: ['Regalo', 'Viaje'] })
  })
})
