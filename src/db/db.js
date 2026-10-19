import Dexie from 'dexie'

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

export default db
