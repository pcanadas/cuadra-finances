/**
 * Campos comunes del modelo de datos v4 (preparación para sincronizar entre dispositivos).
 *
 * Tablas sincronizables: cada registro lleva `updatedAt` (ms) y `hlc` (ver hlc.js), que pone
 * db.js en cada escritura. Borrar uno deja una lápida `{ id, deletedAt }` sin el contenido,
 * para que el borrado llegue a los demás dispositivos sin guardar los datos borrados.
 *
 * Movimientos:
 * - origen: 'manual' (apuntado a mano o contrapartida de un traspaso) | 'importado' (extracto)
 * - importId: importación de la que viene (agrupa los movimientos de un mismo extracto)
 * - importHash: fecha + concepto + importe, igual en todos los dispositivos (no incluye la
 *   cuenta: los ids de las cuentas creadas por el usuario difieren entre dispositivos).
 *   No es único: dos cafés iguales el mismo día tienen el mismo.
 */

export const SYNCED_TABLES = ['transactions', 'categories', 'subcategories', 'accounts', 'budgets', 'recurringExpenses', 'goals']

export const isDeleted = (r) => r?.deletedAt != null
export const tombstone = (id, now = Date.now()) => ({ id, deletedAt: now })

/** Hash corto y estable (cyrb53) en base 36. */
function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export function importHash(t) {
  const desc = String(t.descripcion ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
  return hash(`${t.fechaContable}|${desc}|${Math.round((t.importe ?? 0) * 100)}`)
}

/** Apuntado a mano (o contrapartida de un traspaso). Los anteriores a la v4 se reconocen por su id. */
export const isManualTx = (t) => (t.origen ? t.origen === 'manual' : !!t.esManual || String(t.id).startsWith('tx-manual'))

/** Completa `origen` e `importHash` de un movimiento nuevo o editado. */
export function completeTransaction(t) {
  if (isDeleted(t)) return t
  const origen = t.origen ?? (isManualTx(t) ? 'manual' : 'importado')
  return origen === 'importado' ? { ...t, origen, importHash: importHash(t) } : { ...t, origen }
}

/** Marca de tiempo de la importación en los ids de las versiones anteriores (`tx-<ms>-…`). */
const legacyStamp = (t) => Number(String(t.id).match(/^tx-(\d+)-/)?.[1] ?? 0)

/**
 * Movimientos de versiones anteriores al modelo v4: origen, importHash e importId. Antes de la
 * 0.8.0 cada fila de un extracto llevaba en su id la hora en que se leyó, así que las de una
 * misma importación se agrupan (marcas a menos de 5 s) y comparten el importId de la primera.
 */
export function migrateTransactions(list) {
  const done = list.map(completeTransaction)
  const legacy = done.filter((t) => t.origen === 'importado' && t.importId == null)
  const stamps = [...new Set(legacy.map(legacyStamp))].sort((a, b) => a - b)
  const batchOf = new Map()
  let first = null, last = -Infinity
  for (const s of stamps) {
    if (s - last > 5000) first = s
    batchOf.set(s, first)
    last = s
  }
  return done.map((t) => (t.origen === 'importado' && t.importId == null ? { ...t, importId: batchOf.get(legacyStamp(t)) } : t))
}

/** Datos de una copia de seguridad (de cualquier versión) llevados al modelo v4. */
export function migrateData(data) {
  return { ...data, transactions: migrateTransactions(data.transactions ?? []) }
}

/** Registro de la tabla `backups` con el estado completo de la base de datos. */
export function snapshot(reason, data, now = new Date()) {
  return {
    id: `bk-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now.toISOString(),
    reason,
    stats: {
      transactions: data.transactions?.length ?? 0,
      categories: data.categories?.length ?? 0,
      subcategories: data.subcategories?.length ?? 0,
      accounts: data.accounts?.length ?? 0,
    },
    data,
  }
}
