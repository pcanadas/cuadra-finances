import { describe, it, expect } from 'vitest'
import { categorizeTransaction, categorizeSubcategory, extractKeyword, autoCategorize } from './categorize'

const CATS = [
  { id: 'cat-1', nombre: 'Mercadona', palabrasClave: ['MERCADONA'], palabrasExcluidas: [], color: '#10b981' },
  { id: 'cat-2', nombre: 'Gasolina',  palabrasClave: ['REPSOL', 'BP'], palabrasExcluidas: ['BP SOLAR'], color: '#f59e0b' },
  { id: 'cat-3', nombre: 'Otros',     palabrasClave: [], palabrasExcluidas: [], color: '#94a3b8' },
]

const SUBCATS = [
  { id: 'sub-1', categoriaId: 'cat-1', nombre: 'Online', palabrasClave: ['MERCADONA ONLINE'], color: '#22c55e' },
  { id: 'sub-2', categoriaId: 'cat-2', nombre: 'Peajes', palabrasClave: ['PEAJE'], color: '#3b82f6' },
]

// ── categorizeTransaction ──────────────────────────────────────────────────

describe('categorizeTransaction', () => {
  it('matches a keyword case-insensitively', () => {
    expect(categorizeTransaction('Compra en Mercadona S.A.', CATS)).toBe('cat-1')
  })

  it('returns "Otros" when no keyword matches', () => {
    expect(categorizeTransaction('PAGO DESCONOCIDO', CATS)).toBe('cat-3')
  })

  it('returns null when no match and no "Otros" category', () => {
    const cats = CATS.filter((c) => c.nombre !== 'Otros')
    expect(categorizeTransaction('PAGO DESCONOCIDO', cats)).toBeNull()
  })

  it('returns null for empty/null description', () => {
    expect(categorizeTransaction('', CATS)).toBeNull()
    expect(categorizeTransaction(null, CATS)).toBeNull()
  })

  it('respects exclusion keywords', () => {
    expect(categorizeTransaction('BP SOLAR PANELS', CATS)).not.toBe('cat-2')
  })

  it('matches when exclusion does not apply', () => {
    expect(categorizeTransaction('REPSOL GASOLINERA', CATS)).toBe('cat-2')
  })

  it('normalises whitespace before matching', () => {
    expect(categorizeTransaction('  MERCADONA   MADRID  ', CATS)).toBe('cat-1')
  })
})

// ── categorizeSubcategory ──────────────────────────────────────────────────

describe('categorizeSubcategory', () => {
  it('matches subcategory by keyword', () => {
    expect(categorizeSubcategory('MERCADONA ONLINE pedido 123', SUBCATS)).toBe('sub-1')
  })

  it('returns null when no keyword matches', () => {
    expect(categorizeSubcategory('MERCADONA TIENDA', SUBCATS)).toBeNull()
  })

  it('returns null for empty description', () => {
    expect(categorizeSubcategory('', SUBCATS)).toBeNull()
  })
})

// ── extractKeyword ─────────────────────────────────────────────────────────

describe('extractKeyword', () => {
  it('strips BIZUM prefix', () => {
    expect(extractKeyword('PAGO BIZUM A JUAN GARCIA')).toBe('JUAN GARCIA')
  })

  it('strips COMPRA prefix', () => {
    expect(extractKeyword('COMPRA MERCADONA')).toBe('MERCADONA')
  })

  it('truncates at 40 chars', () => {
    const long = 'A'.repeat(60)
    expect(extractKeyword(long).length).toBe(40)
  })

  it('returns null for short/empty descriptions', () => {
    expect(extractKeyword('AB')).toBeNull()
    expect(extractKeyword('')).toBeNull()
    expect(extractKeyword(null)).toBeNull()
  })

  it('strips date patterns', () => {
    const result = extractKeyword('REPSOL 15/03/2026 FACTURA')
    expect(result).toBe('REPSOL')
  })
})

// ── autoCategorize ─────────────────────────────────────────────────────────

describe('autoCategorize', () => {
  it('assigns category and subcategory', () => {
    const txs = [{ descripcion: 'MERCADONA ONLINE pedido 5', categoria: null, subcategoria: null }]
    const result = autoCategorize(txs, CATS, SUBCATS)
    expect(result[0].categoria).toBe('cat-1')
    expect(result[0].subcategoria).toBe('sub-1')
  })

  it('preserves existing manual category', () => {
    const txs = [{ descripcion: 'MERCADONA', categoria: 'cat-99', subcategoria: null }]
    const result = autoCategorize(txs, CATS, SUBCATS)
    expect(result[0].categoria).toBe('cat-99')
  })

  it('preserves existing subcategory', () => {
    const txs = [{ descripcion: 'MERCADONA ONLINE', categoria: null, subcategoria: 'sub-99' }]
    const result = autoCategorize(txs, CATS, SUBCATS)
    expect(result[0].subcategoria).toBe('sub-99')
  })

  it('only searches subcategories of matched category', () => {
    // PEAJE subcategory belongs to cat-2 (Gasolina), not cat-1
    const txs = [{ descripcion: 'MERCADONA PEAJE', categoria: null, subcategoria: null }]
    const result = autoCategorize(txs, CATS, SUBCATS)
    expect(result[0].categoria).toBe('cat-1')
    // sub-2 (Peajes) belongs to cat-2, so it should NOT be assigned
    expect(result[0].subcategoria).toBeNull()
  })
})
