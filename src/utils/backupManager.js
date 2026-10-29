import db, { live, replaceAllData } from '../db/db'
import { SYNCED_TABLES, snapshot } from '../db/records'

const MAX_BACKUPS = 10

/** Todos los datos vigentes, por tabla (lo que guarda una copia de seguridad). */
export async function readAllData() {
  const lists = await Promise.all(SYNCED_TABLES.map((name) => live(db.table(name))))
  return Object.fromEntries(SYNCED_TABLES.map((name, i) => [name, lists[i]]))
}

/**
 * Create a snapshot of the current database state and store it in the backups table.
 * @param {string} reason - Why the backup was created (e.g. "auto: antes de restaurar", "manual")
 */
export async function createBackup(reason = 'manual') {
  const backup = snapshot(reason, await readAllData())

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

  await replaceAllData(backup.data)
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
    schemaVersion: 5,
    exportedAt: backup.createdAt,
    transactions: backup.data.transactions,
    categories: backup.data.categories,
    subcategories: backup.data.subcategories,
    accounts: backup.data.accounts,
    budgets: backup.data.budgets,
    recurringExpenses: backup.data.recurringExpenses,
    goals: backup.data.goals ?? [],
  }
}
