import db from '../db/db'

const MAX_BACKUPS = 10

/**
 * Create a snapshot of the current database state and store it in the backups table.
 * @param {string} reason - Why the backup was created (e.g. "auto: antes de restaurar", "manual")
 */
export async function createBackup(reason = 'manual') {
  const [transactions, categories, subcategories, accounts, budgets, recurringExpenses] = await Promise.all([
    db.transactions.toArray(),
    db.categories.toArray(),
    db.subcategories.toArray(),
    db.accounts.toArray(),
    db.budgets.toArray(),
    db.recurringExpenses.toArray(),
  ])

  const backup = {
    id: `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    reason,
    stats: {
      transactions: transactions.length,
      categories: categories.length,
      subcategories: subcategories.length,
      accounts: accounts.length,
    },
    data: { transactions, categories, subcategories, accounts, budgets, recurringExpenses },
  }

  await db.backups.put(backup)

  // Prune old backups beyond MAX_BACKUPS
  const all = await db.backups.orderBy('createdAt').reverse().toArray()
  if (all.length > MAX_BACKUPS) {
    const toDelete = all.slice(MAX_BACKUPS).map((b) => b.id)
    await db.backups.bulkDelete(toDelete)
  }

  return backup
}

/**
 * List all stored backups, newest first.
 */
export async function listBackups() {
  return db.backups.orderBy('createdAt').reverse().toArray()
}

/**
 * Restore the database from a stored backup.
 * Creates an auto-backup of the current state before restoring.
 */
export async function restoreBackup(backupId) {
  const backup = await db.backups.get(backupId)
  if (!backup) throw new Error('Backup no encontrado')

  // Auto-backup current state before overwriting
  await createBackup('auto: antes de restaurar')

  const { transactions, categories, subcategories, accounts, budgets, recurringExpenses } = backup.data

  await db.transaction('rw', db.transactions, db.categories, db.subcategories, db.accounts, db.budgets, db.recurringExpenses, async () => {
    await db.transactions.clear()
    await db.categories.clear()
    await db.subcategories.clear()
    await db.accounts.clear()
    await db.budgets.clear()
    await db.recurringExpenses.clear()
    if (transactions?.length)       await db.transactions.bulkPut(transactions)
    if (categories?.length)         await db.categories.bulkPut(categories)
    if (subcategories?.length)      await db.subcategories.bulkPut(subcategories)
    if (accounts?.length)           await db.accounts.bulkPut(accounts)
    if (budgets?.length)            await db.budgets.bulkPut(budgets)
    if (recurringExpenses?.length)  await db.recurringExpenses.bulkPut(recurringExpenses)
  })
}

/**
 * Delete a stored backup.
 */
export async function deleteBackup(backupId) {
  await db.backups.delete(backupId)
}

/**
 * Export a backup as a downloadable JSON (same format as manual export).
 */
export function backupToJson(backup) {
  return {
    version: 1,
    exportedAt: backup.createdAt,
    transactions: backup.data.transactions,
    categories: backup.data.categories,
    subcategories: backup.data.subcategories,
    accounts: backup.data.accounts,
    budgets: backup.data.budgets,
    recurringExpenses: backup.data.recurringExpenses,
  }
}
