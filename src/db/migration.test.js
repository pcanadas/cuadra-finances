import 'fake-indexeddb/auto'
import { describe, it, expect, beforeAll } from 'vitest'
import Dexie from 'dexie'

// Base de datos tal como la dejaba la 0.8.0 (esquema v3), con datos ficticios
const V3 = {
  transactions:  'id, fechaContable, categoria, subcategoria, accountId',
  categories:    'id',
  subcategories: 'id, categoriaId',
  accounts:      'id',
  backups:       'id, createdAt',
  budgets:       'id, categoriaId',
  recurringExpenses: 'id',
}
const LEGACY = {
  transactions: [
    // Dos filas de la misma importación (leídas con 1 ms de diferencia) y otra importación posterior
    { id: 'tx-1700000000000-0-aa', fechaContable: '2026-01-02', descripcion: 'MERCADONA', importe: -45.3, saldo: 954.7, categoria: 'cat-1', accountId: 'acc-1' },
    { id: 'tx-1700000000001-1-bb', fechaContable: '2026-01-03', descripcion: 'NOMINA', importe: 2000, saldo: 2954.7, categoria: 'cat-14', accountId: 'acc-1' },
    { id: 'tx-1700000900000-0-cc', fechaContable: '2026-02-01', descripcion: 'ALQUILER', importe: -750, saldo: 2204.7, accountId: 'acc-1' },
    // Desde la 0.8.0 los extractos ya traen importId
    { id: 'tx-1700001000000-0-dd', importId: 1700001000000, fechaContable: '2026-03-01', descripcion: 'LUZ', importe: -60, saldo: 2144.7, accountId: 'acc-1' },
    { id: 'tx-manual-1700000000500-xy', esManual: true, fechaContable: '2026-01-05', descripcion: 'Café', importe: -1.5, accountId: 'acc-2' },
  ],
  categories: [{ id: 'cat-1', nombre: 'Alimentación' }, { id: 'cat-14', nombre: 'Ingresos', esIngreso: true }],
  subcategories: [{ id: 'subcat-cajero', categoriaId: 'cat-14', nombre: 'Cajero' }],
  accounts: [{ id: 'acc-1', nombre: 'Banco', tipo: 'banco' }, { id: 'acc-2', nombre: 'Efectivo', tipo: 'efectivo' }],
  budgets: [{ id: 'budget-1', categoriaId: 'cat-1', limite: 300 }],
  recurringExpenses: [{ id: 'rec-1', nombre: 'Gimnasio', importe: 30, activo: true }],
}

let db
beforeAll(async () => {
  const old = new Dexie('CuadraFinances')
  old.version(3).stores(V3)
  await old.open()
  for (const [table, rows] of Object.entries(LEGACY)) await old.table(table).bulkPut(rows)
  old.close()
  db = (await import('./db')).default
  await db.open()
})

describe('migración a v4', () => {
  it('guarda una copia de seguridad con los datos de antes', async () => {
    const backups = await db.backups.toArray()
    expect(backups).toHaveLength(1)
    expect(backups[0].reason).toBe('auto: antes de actualizar la base de datos')
    expect(backups[0].data.transactions).toEqual(LEGACY.transactions)
    expect(backups[0].stats.transactions).toBe(5)
  })

  it('conserva todos los registros y sus ids', async () => {
    for (const [table, rows] of Object.entries(LEGACY)) {
      const ids = (await db.table(table).toArray()).map((r) => r.id).sort()
      expect(ids).toEqual(rows.map((r) => r.id).sort())
    }
    expect((await db.transactions.get('tx-1700000000001-1-bb')).saldo).toBe(2954.7)
  })

  it('pone updatedAt y hlc en todas las tablas sincronizables', async () => {
    for (const table of ['transactions', 'categories', 'subcategories', 'accounts', 'budgets', 'recurringExpenses']) {
      for (const r of await db.table(table).toArray()) {
        expect(typeof r.updatedAt).toBe('number')
        expect(r.hlc).toMatch(/^\d{13}:[0-9a-z]{5}:[0-9a-f-]{36}$/)
      }
    }
  })

  it('distingue movimientos manuales e importados', async () => {
    const manual = await db.transactions.get('tx-manual-1700000000500-xy')
    expect(manual.origen).toBe('manual')
    expect(manual.importHash).toBeUndefined()
    const imported = await db.transactions.get('tx-1700000000000-0-aa')
    expect(imported.origen).toBe('importado')
    expect(imported.importHash).toMatch(/^[0-9a-z]+$/)
  })

  it('agrupa por importación los extractos anteriores a la 0.8.0', async () => {
    const importId = async (id) => (await db.transactions.get(id)).importId
    expect(await importId('tx-1700000000000-0-aa')).toBe(1700000000000)
    expect(await importId('tx-1700000000001-1-bb')).toBe(1700000000000)
    expect(await importId('tx-1700000900000-0-cc')).toBe(1700000900000)
    expect(await importId('tx-1700001000000-0-dd')).toBe(1700001000000)
  })

  it('crea la tabla de ahorro y metas (v5)', async () => {
    expect(db.verno).toBe(5)
    expect(await db.goals.count()).toBe(0)
  })

  it('crea los índices nuevos', async () => {
    const hash = (await db.transactions.get('tx-1700000000000-0-aa')).importHash
    expect(await db.transactions.where('importHash').equals(hash).count()).toBe(1)
    expect(await db.categories.orderBy('hlc').count()).toBe(2)
  })
})
