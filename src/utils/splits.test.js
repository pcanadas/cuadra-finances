import { describe, it, expect } from 'vitest'
import { expandSplits, hasSplit, splitRemainder } from './splits'

const amazon = {
  id: 'tx-1', fechaContable: '2026-11-02', descripcion: 'AMAZON EU', importe: -60.5, accountId: 'acc-1', categoria: null,
  desglose: [
    { importe: -25.5, categoria: 'cat-mascotas', subcategoria: 'sub-pienso' },
    { importe: -35, categoria: 'cat-ropa', subcategoria: null, notas: 'Abrigo' },
  ],
}

describe('splits', () => {
  it('reconoce los movimientos desglosados', () => {
    expect(hasSplit(amazon)).toBe(true)
    expect(hasSplit({ id: 'x', desglose: [] })).toBe(false)
    expect(hasSplit({ id: 'x' })).toBe(false)
  })

  it('calcula lo que falta por repartir sin errores de redondeo', () => {
    expect(splitRemainder(-60.5, amazon.desglose)).toBe(0)
    expect(splitRemainder(-0.3, [{ importe: -0.1 }, { importe: -0.1 }])).toBe(-0.1)
    expect(splitRemainder(-10, [{ importe: '' }])).toBe(-10)
  })

  it('sustituye cada desglose por sus partidas conservando el total', () => {
    const plain = { id: 'tx-2', importe: -5, categoria: 'cat-cafe' }
    const out = expandSplits([plain, amazon])
    expect(out).toHaveLength(3)
    expect(out[0]).toBe(plain)
    expect(out[1]).toMatchObject({ id: 'tx-1:0', splitOf: 'tx-1', importe: -25.5, categoria: 'cat-mascotas', subcategoria: 'sub-pienso', accountId: 'acc-1', fechaContable: '2026-11-02' })
    expect(out[2]).toMatchObject({ categoria: 'cat-ropa', notas: 'Abrigo' })
    expect(out[1].desglose).toBeUndefined()
    expect(out.reduce((s, t) => s + t.importe, 0)).toBeCloseTo(-65.5)
  })

  it('devuelve la misma lista si no hay desgloses', () => {
    const list = [{ id: 'a', importe: 1 }]
    expect(expandSplits(list)).toBe(list)
  })
})
