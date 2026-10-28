import { describe, it, expect } from 'vitest'
import { mapRows, rowsFromCsvMatrix, guessMapping, withSignedAmount, parseAmount, parseDate, detectDayFirst } from './importParsers'

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
    expect(result[0].id).toMatch(/^[0-9a-f-]{36}$/)
    expect(result[0].origen).toBe('importado')
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
    expect(result[0].saldo).toBeNull() // sin saldo, no saldo 0
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

describe('extractos con cabeceras en inglés', () => {
  it('guesses the mapping from English headers without reusing columns', () => {
    expect(guessMapping(['Value Date', 'Booking Date', 'Description', 'Amount', 'Balance'])).toEqual({
      fechaContable: 'Booking Date', fechaValor: 'Value Date', descripcion: 'Description', importe: 'Amount', saldo: 'Balance',
    })
    // Revolut / N26 / Wise
    expect(guessMapping(['Type', 'Started Date', 'Completed Date', 'Description', 'Amount', 'Fee', 'Balance']).fechaContable).toBe('Completed Date')
    expect(guessMapping(['Booking Date', 'Partner Name', 'Payment Reference', 'Amount (EUR)']).descripcion).toBe('Partner Name')
    expect(guessMapping(['Date', 'Amount', 'Description', 'Running Balance']).saldo).toBe('Running Balance')
  })

  it('keeps the Spanish mapping as before', () => {
    expect(guessMapping(['Fecha contable', 'Fecha valor', 'Descripción', 'Importe', 'Saldo'])).toEqual(MAPPING)
  })

  it('finds an English header after metadata lines', () => {
    const rows = rowsFromCsvMatrix([
      ['Account', 'GB00 0000'],
      ['Transaction Date', 'Description', 'Amount', 'Balance'],
      ['27/10/2026', 'TESCO', '-12.50', '1,234.56'],
    ])
    expect(rows).toEqual([{ 'Transaction Date': '27/10/2026', Description: 'TESCO', Amount: '-12.50', Balance: '1,234.56' }])
  })

  it('does not overwrite empty or repeated headers', () => {
    const [row] = rowsFromCsvMatrix([['Date', 'Amount', 'Amount', ''], ['2026-10-01', '1', '2', 'x']])
    expect(row).toEqual({ Date: '2026-10-01', Amount: '1', Amount_1: '2', 'Columna 4': 'x' })
  })

  it('merges separate debit / credit columns into a signed Importe', () => {
    const rows = withSignedAmount([
      { 'Transaction Date': '01/10/2026', 'Debit Amount': '12.50', 'Credit Amount': '' },
      { 'Transaction Date': '02/10/2026', 'Debit Amount': '', 'Credit Amount': '1,000.00' },
      { 'Transaction Date': '03/10/2026', 'Debit Amount': '', 'Credit Amount': '' },
    ])
    expect(rows.map((r) => r.Importe)).toEqual([-12.5, 1000, ''])
    expect(withSignedAmount([{ Fecha: '1', Cargo: '5,00', Abono: '' }])[0].Importe).toBe(-5)
  })

  it('leaves rows alone when there is a single amount column', () => {
    const rows = [{ Date: '1', Amount: '-5', 'Money Out': '5', 'Money In': '' }]
    expect(withSignedAmount(rows)).toBe(rows)
  })

  it('parses English and other amount formats', () => {
    expect(parseAmount('1,234.56')).toBeCloseTo(1234.56)
    expect(parseAmount('-1,234.56')).toBeCloseTo(-1234.56)
    expect(parseAmount('£12.50')).toBeCloseTo(12.5)
    expect(parseAmount('(12.50)')).toBeCloseTo(-12.5)
    expect(parseAmount('12,50-')).toBeCloseTo(-12.5)
    expect(parseAmount('1.000,00EUR')).toBeCloseTo(1000)
    expect(parseAmount('1.234')).toBeCloseTo(1234)
    expect(parseAmount('1,000')).toBeCloseTo(1000)
  })

  it('parses dates with month names, ISO with time and compact formats', () => {
    expect(parseDate('27 Oct 2026')).toBe('2026-10-27')
    expect(parseDate('27-oct-26')).toBe('2026-10-27')
    expect(parseDate('Oct 27, 2026')).toBe('2026-10-27')
    expect(parseDate('October 3rd 2026')).toBe('2026-10-03')
    expect(parseDate('3 de octubre de 2026')).toBe('2026-10-03')
    expect(parseDate('2026-10-27 14:33:12')).toBe('2026-10-27')
    expect(parseDate('2026/10/27')).toBe('2026-10-27')
    expect(parseDate('20261027')).toBe('2026-10-27')
    expect(parseDate('27/10/26')).toBe('2026-10-27')
  })

  it('detects US month/day order from the whole column', () => {
    expect(detectDayFirst(['10/01/2026', '10/27/2026'])).toBe(false)
    expect(detectDayFirst(['01/10/2026', '27/10/2026'])).toBe(true)
    expect(detectDayFirst(['01/10/2026'])).toBe(true) // ambiguo: día/mes
    const [a] = mapRows(
      [{ Date: '10/01/2026', Description: 'X', Amount: '-1' }, { Date: '10/27/2026', Description: 'Y', Amount: '-1' }],
      { fechaContable: 'Date', descripcion: 'Description', importe: 'Amount' },
    )
    expect(a.fechaContable).toBe('2026-10-01')
  })
})
