import * as XLSX from 'xlsx'
import { createBackup, readAllData } from './backupManager'
import { saveFile, describeSavedPath } from '../platform/files'
import { markBackupDone } from './backupReminder'

const today = () => new Date().toISOString().slice(0, 10)

/** Exporta movimientos a Excel. Devuelve la ruta guardada o null si se cancela. */
export async function exportTransactionsToExcel(transactions, { categories, subcategories, accounts }) {
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.nombre]))
  const subMap = Object.fromEntries(subcategories.map((s) => [s.id, s.nombre]))
  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))
  const rows = transactions.map((t) => ({
    Fecha: t.fechaContable,
    Descripción: t.descripcion,
    Importe: t.importe,
    Categoría: catMap[t.categoria] || '',
    Subcategoría: subMap[t.subcategoria] || '',
    Cuenta: accMap[t.accountId] || '',
    Notas: t.notas || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return saveFile({
    filename: `movimientos-${today()}.xlsx`,
    data: new Uint8Array(data),
    filter: { name: 'Excel', extensions: ['xlsx'] },
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Guarda un JSON de backup pidiendo ubicación y avisa del resultado. */
export async function saveBackupJson(filename, json) {
  try {
    const path = await saveFile({ filename, data: json, filter: { name: 'JSON', extensions: ['json'] }, mime: 'application/json' })
    if (!path) return
    markBackupDone()
    if (path === 'download') return
    const where = describeSavedPath(path)
    alert(where ? `Backup guardado en:\n${where}` : 'Backup guardado.')
  } catch (e) {
    alert(`No se pudo guardar el backup:\n${e?.message ?? e}`)
  }
}

/** Copia de seguridad completa (todas las tablas) a un archivo JSON. */
export async function exportFullBackup() {
  await createBackup('manual: exportación')
  const payload = { version: 1, schemaVersion: 5, exportedAt: new Date().toISOString(), ...(await readAllData()) }
  await saveBackupJson(`zenit-backup-${today()}.json`, JSON.stringify(payload, null, 2))
}
