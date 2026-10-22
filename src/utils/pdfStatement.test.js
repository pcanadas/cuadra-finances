import { describe, it, expect } from 'vitest'
import { parseStatementLines, parseSpanishAmount, normalizeDate } from './pdfStatement'

// Línea simulada: [[texto, x], ...] a una altura y
const line = (y, cells, page = 1) => ({ page, y, items: cells.map(([str, x, w]) => ({ str, x, w: w ?? str.length * 5 })) })

describe('parseSpanishAmount', () => {
  it('reads Spanish formats and signs', () => {
    expect(parseSpanishAmount('1.234,56')).toBeCloseTo(1234.56)
    expect(parseSpanishAmount('-12,50')).toBeCloseTo(-12.5)
    expect(parseSpanishAmount('12,50-')).toBeCloseTo(-12.5)
    expect(parseSpanishAmount('3.000,00 €')).toBeCloseTo(3000)
  })
})

describe('normalizeDate', () => {
  it('pads and expands two-digit years', () => {
    expect(normalizeDate('1/3/26')).toBe('01/03/2026')
    expect(normalizeDate('15-10-2026')).toBe('15/10/2026')
  })
})

describe('parseStatementLines', () => {
  it('reads signed amounts with balance (one item per column)', () => {
    const rows = parseStatementLines([
      line(700, [['Fecha', 40], ['Concepto', 120], ['Importe', 400], ['Saldo', 480]]),
      line(680, [['01/10/2026', 40], ['COMPRA MERCADONA 4521', 120], ['-85,00', 400], ['1.915,02', 480]]),
      line(665, [['02/10/2026', 40], ['NOMINA OCTUBRE', 120], ['2.200,00', 400], ['4.115,02', 480]]),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ 'Fecha contable': '01/10/2026', 'Descripción': 'COMPRA MERCADONA 4521', 'Importe': -85, 'Saldo': 1915.02 })
    expect(rows[1].Importe).toBeCloseTo(2200)
  })

  it('handles two dates and text joined in a single item', () => {
    const rows = parseStatementLines([
      line(680, [['01/10/2026 03/10/2026 RECIBO ENDESA LUZ -70,15 1.234,56', 40, 300]]),
    ])
    expect(rows[0]).toMatchObject({ 'Fecha contable': '01/10/2026', 'Fecha valor': '03/10/2026', 'Descripción': 'RECIBO ENDESA LUZ', 'Importe': -70.15, 'Saldo': 1234.56 })
  })

  it('joins wrapped descriptions aligned with the concept column and skips footers', () => {
    const rows = parseStatementLines([
      line(680, [['05/10/2026', 40], ['TRANSFERENCIA A FAVOR DE', 120], ['-300,00', 400], ['900,00', 480]]),
      line(668, [['JUAN PEREZ ALQUILER', 120]]),
      line(600, [['Página 1 de 2', 260]]),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]['Descripción']).toBe('TRANSFERENCIA A FAVOR DE JUAN PEREZ ALQUILER')
  })

  it('uses Cargo/Abono columns for the sign', () => {
    const rows = parseStatementLines([
      line(700, [['Fecha', 40], ['Concepto', 120], ['Cargo', 360, 25], ['Abono', 420, 25], ['Saldo', 490, 25]]),
      line(680, [['06/10/2026', 40], ['FARMACIA CENTRAL', 120], ['15,00', 365, 25], ['885,00', 490, 30]]),
      line(665, [['07/10/2026', 40], ['BIZUM RECIBIDO', 120], ['20,00', 425, 25], ['905,00', 490, 30]]),
    ])
    expect(rows[0].Importe).toBeCloseTo(-15)
    expect(rows[0].Saldo).toBeCloseTo(885)
    expect(rows[1].Importe).toBeCloseTo(20)
  })

  it('infers the sign from the balance when amounts are unsigned (newest first)', () => {
    const rows = parseStatementLines([
      line(680, [['08/10/2026', 40], ['COMPRA ZARA', 120], ['50,00', 400], ['950,00', 480]]),
      line(665, [['07/10/2026', 40], ['BIZUM RECIBIDO', 120], ['100,00', 400], ['1.000,00', 480]]),
      line(650, [['06/10/2026', 40], ['GASOLINERA BP', 120], ['60,00', 400], ['900,00', 480]]),
      line(635, [['05/10/2026', 40], ['SALDO PREVIO', 120], ['10,00', 400], ['960,00', 480]]),
    ])
    // El último no tiene anterior con el que comparar
    expect(rows.slice(0, 3).map((r) => r.Importe)).toEqual([-50, 100, -60])
  })

  it('ignores lines without a leading date or without amounts', () => {
    const rows = parseStatementLines([
      line(760, [['Extracto de movimientos', 40]]),
      line(740, [['Titular: PATRICIA', 40]]),
      line(720, [['IBAN ES12 3456 7890 1234 5678 9012', 40]]),
      line(680, [['09/10/2026', 40], ['AMAZON', 120], ['-42,00', 400]]),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].Saldo).toBe('')
  })
})
