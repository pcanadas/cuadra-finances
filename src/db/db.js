import Dexie from 'dexie'
import { nextHlc } from './hlc'
import { SYNCED_TABLES, completeTransaction, isDeleted, migrateData, snapshot, tombstone } from './records'

/**
 * Cuadra Finances database.
 * Transactions are stored as individual records for efficient updates.
 * Categories and subcategories are stored as individual records too.
 */
const db = new Dexie('CuadraFinances')

db.version(1).stores({
  transactions:  'id, fechaContable, categoria, subcategoria',
  categories:    'id',
  subcategories: 'id, categoriaId',
})

db.version(2).stores({
  transactions:  'id, fechaContable, categoria, subcategoria, accountId',
  categories:    'id',
  subcategories: 'id, categoriaId',
  accounts:      'id',
})

db.version(3).stores({
  transactions:  'id, fechaContable, categoria, subcategoria, accountId',
  categories:    'id',
  subcategories: 'id, categoriaId',
  accounts:      'id',
  backups:       'id, createdAt',
  budgets:       'id, categoriaId',
  recurringExpenses: 'id',
})

// v4: preparación para sincronizar (ver records.js). Copia de seguridad antes de migrar.
// Tablas que existían en la v4: al actualizar desde la v3, las de versiones posteriores aún no están.
const V4_TABLES = ['transactions', 'categories', 'subcategories', 'accounts', 'budgets', 'recurringExpenses']
db.version(4).stores({
  transactions:  'id, fechaContable, categoria, subcategoria, accountId, hlc, importHash',
  categories:    'id, hlc',
  subcategories: 'id, categoriaId, hlc',
  accounts:      'id, hlc',
  backups:       'id, createdAt',
  budgets:       'id, categoriaId, hlc',
  recurringExpenses: 'id, hlc',
}).upgrade(async (tx) => {
  const data = {}
  for (const name of V4_TABLES) data[name] = await tx.table(name).toArray()
  if (Object.values(data).every((list) => !list.length)) return
  await tx.table('backups').put(snapshot('auto: antes de actualizar la base de datos', data))
  // Vaciar y volver a añadir (en la misma transacción) es mucho más rápido que sobrescribir
  const migrated = migrateData(data)
  for (const name of V4_TABLES) {
    await tx.table(name).clear()
    await tx.table(name).bulkAdd(migrated[name])
  }
})

// v5: planes de ahorro y metas (ver insights/goals.js)
db.version(5).stores({
  goals: 'id, hlc',
})

// Cada escritura en una tabla sincronizable lleva su marca de tiempo; los movimientos, además,
// su origen e importHash al día.
for (const name of SYNCED_TABLES) {
  const table = db.table(name)
  table.hook('creating', (_pk, obj) => {
    const now = Date.now()
    if (name === 'transactions') Object.assign(obj, completeTransaction(obj))
    Object.assign(obj, { updatedAt: now, hlc: nextHlc(now) })
  })
  table.hook('updating', (mods, _pk, obj) => {
    const now = Date.now()
    const extra = { updatedAt: now, hlc: nextHlc(now) }
    if (name === 'transactions') {
      const next = { ...obj, ...mods }
      if (!isDeleted(next)) {
        const done = completeTransaction(next)
        if (done.origen !== obj.origen) extra.origen = done.origen
        if (done.importHash !== obj.importHash) extra.importHash = done.importHash
      }
    }
    return extra
  })
}

/** Registros vigentes de una tabla (sin las lápidas de los borrados). */
export const live = (table) => table.filter((r) => !isDeleted(r)).toArray()

/** Borra registros dejando una lápida sin su contenido (ver records.js). */
export async function softDelete(table, ids) {
  if (ids.length) await table.bulkPut(ids.map((id) => tombstone(id)))
}

/**
 * Sustituye todos los datos por los de una copia de seguridad (de cualquier versión).
 * Borrado completo: no deja lápidas.
 */
export async function replaceAllData(data) {
  const migrated = migrateData(data)
  await db.transaction('rw', SYNCED_TABLES, async () => {
    for (const name of SYNCED_TABLES) {
      await db.table(name).clear()
      if (migrated[name]?.length) await db.table(name).bulkPut(migrated[name])
    }
  })
}

export default db
