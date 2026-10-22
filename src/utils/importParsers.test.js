import { describe, it, expect } from 'vitest'
import { mapRows, rowsFromCsvMatrix } from './importParsers'

const MAPPING = {
  fechaContable: 'Fecha contable',
  fechaValor: 'Fecha valor',
  descripcion: 'Descripción',
  importe: 'Importe',
  saldo: 'Saldo',
}

describe('mapRows', () => {
  it('maps basic row with Spanish date format', () => {
    const rows = [{
      'Fecha contable': '15/03/2026',
      'Fecha valor': '16/03/2026',
      'Descripción': 'MERCADONA',
      'Importe': '-45,30',
      'Saldo': '1.234,56',
    }]
    const result = mapRows(rows, MAPPING)
    expect(result).toHaveLength(1)
    expect(result[0].fechaContable).toBe('2026-03-15')
    expect(result[0].fechaValor).toBe('2026-03-16')
    expect(result[0].descripcion).toBe('MERCADONA')
    expect(result[0].importe).toBeCloseTo(-45.30)
    expect(result[0].saldo).toBeCloseTo(1234.56)
    expect(result[0].categoria).toBeNull()
    expect(result[0].id).toMatch(/^tx-/)
  })

  it('parses Spanish thousands format', () => {
    const rows = [{ 'Fecha contable': '01/01/2026', 'Descripción': 'test', 'Importe': '1.234,56', 'Saldo': '' }]
    const result = mapRows(rows, MAPPING)
    expect(result[0].importe).toBeCloseTo(1234.56)
  })

  it('parses dot-decimal format', () => {
    const rows = [{ 'Fecha contable': '01/01/2026', 'Descripción': 'test', 'Importe': '1234.56', 'Saldo': '' }]
    const result = mapRows(rows, MAPPING)
    expect(result[0].importe).toBeCloseTo(1234.56)
  })

  it('handles numeric Excel cell directly', () => {
    const rows = [{ 'Fecha contable': '2026-01-01', 'Descripción': 'test', 'Importe': -99.5, 'Saldo': 500 }]
    const result = mapRows(rows, MAPPING)
    expect(result[0].importe).toBe(-99.5)
    expect(result[0].saldo).toBe(500)
  })

  it('parses ISO date passthrough', () => {
    const rows = [{ 'Fecha contable': '2026-03-15', 'Descripción': 'test', 'Importe': '0', 'Saldo': '' }]
    const result = mapRows(rows, MAPPING)
    expect(result[0].fechaContable).toBe('2026-03-15')
  })

  it('parses dash-separated date', () => {
    const rows = [{ 'Fecha contable': '15-03-2026', 'Descripción': 'test', 'Importe': '0', 'Saldo': '' }]
    const result = mapRows(rows, MAPPING)
    expect(result[0].fechaContable).toBe('2026-03-15')
  })

  it('handles empty importe and saldo', () => {
    const rows = [{ 'Fecha contable': '01/01/2026', 'Descripción': 'test', 'Importe': '', 'Saldo': '' }]
    const result = mapRows(rows, MAPPING)
    expect(result[0].importe).toBe(0)
    expect(result[0].saldo).toBe(0)
  })

  it('trims description whitespace', () => {
    const rows = [{ 'Fecha contable': '01/01/2026', 'Descripción': '  MERCADONA  ', 'Importe': '0', 'Saldo': '' }]
    const result = mapRows(rows, MAPPING)
    expect(result[0].descripcion).toBe('MERCADONA')
  })

  it('assigns bankRowIndex from position', () => {
    const rows = [
      { 'Fecha contable': '01/01/2026', 'Descripción': 'A', 'Importe': '1', 'Saldo': '' },
      { 'Fecha contable': '02/01/2026', 'Descripción': 'B', 'Importe': '2', 'Saldo': '' },
    ]
    const result = mapRows(rows, MAPPING)
    expect(result[0].bankRowIndex).toBe(0)
    expect(result[1].bankRowIndex).toBe(1)
  })
})

describe('rowsFromCsvMatrix', () => {
  it('skips metadata lines before the real header (CaixaBank style)', () => {
    const matrix = [
      ['\uFEFFTitular', 'IBAN', 'Periodo', 'Saldo disponible'],
      ['NOMBRE APELLIDO', 'ES0000000000000000000000', '01/01/2026-22/10/2026', '1000.00'],
      ['Concepto', 'Fecha', 'Importe', 'Saldo'],
      ['PAGO TRASPASOS', '05/10/2026', '-196.0', '1.000,00EUR'],
      ['NOMINA', '02/10/2026', '400.0', '1.196,00EUR'],
    ]
    const rows = rowsFromCsvMatrix(matrix)
    expect(rows).toHaveLength(2)
    const [t] = mapRows(rows, { fechaContable: 'Fecha', descripcion: 'Concepto', importe: 'Importe', saldo: 'Saldo' })
    expect(t.fechaContable).toBe('2026-10-05')
    expect(t.importe).toBeCloseTo(-196)
    expect(t.saldo).toBeCloseTo(1000)
  })

  it('keeps the first row as header when there is no metadata', () => {
    const rows = rowsFromCsvMatrix([['Fecha', 'Concepto', 'Importe'], ['01/10/2026', 'X', '-1,00']])
    expect(rows).toEqual([{ Fecha: '01/10/2026', Concepto: 'X', Importe: '-1,00' }])
  })
})
