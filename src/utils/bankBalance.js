/**
 * Coherencia de los saldos del banco y duplicados entre importaciones.
 *
 * Un movimiento importado con saldo cuadra si hay otro de la misma cuenta, a pocos días,
 * cuyo saldo más este importe da el saldo de este. No se reconstruye una cadena global:
 * Bankinter mezcla el orden de las fechas y, en años de datos, una cadena así se rompe
 * por cualquier eslabón dudoso.
 *
 * Todas las funciones reciben los movimientos de UNA cuenta.
 */

import { isManualTx } from '../db/records'

const DAY = 86_400_000
export const WINDOW_DAYS = 31     // el banco puede anotar un movimiento con fecha bastante anterior
const WINDOW_COUNT = 50           // o entre los 50 movimientos más cercanos por fecha (cuentas con poco movimiento)
const TOLERANCE_CENTS = 2         // redondeos de céntimos en algunos extractos
const PENDING_MATCH_DAYS = 10     // un pendiente se contabiliza días después (Amazon cobra al enviar: a veces casi una semana)

const cents = (n) => Math.round(n * 100)
const daysBetween = (a, b) => Math.abs(new Date(a.fechaContable) - new Date(b.fechaContable)) / DAY
const movementKey = (t) => `${t.fechaContable}|${t.descripcion}|${t.importe}`
const normalize = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Movimiento traído de un extracto (no apuntado a mano). */
export const isImported = (t) => !isManualTx(t)

/**
 * Pendiente del banco: aún sin saldo. Las versiones anteriores guardaban el saldo vacío
 * como 0, así que un saldo 0 importado se trata también como pendiente si no encaja con nada.
 */
export const isPending = (t) => !!t.pendiente

/** Índice saldo (céntimos) → movimientos, para buscar vecinos en O(1). */
function indexBy(list, keyOf) {
  const map = new Map()
  for (const t of list) {
    const k = keyOf(t)
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(t)
  }
  return map
}

/** ¿Hay un movimiento con saldo `k` (±céntimos) cerca de `t`: a pocos días o entre sus vecinos por fecha? */
function findNear(index, k, t, near) {
  for (let d = -TOLERANCE_CENTS; d <= TOLERANCE_CENTS; d++) {
    if ((index.get(k + d) ?? []).some((x) => x !== t && near(x, t))) return true
  }
  return false
}

/**
 * @returns {{ issues: object[], pending: object[], withBalance: object[] }}
 *   issues: movimientos con saldo que no encajan con ningún anterior (falta algo justo antes,
 *           o el dato del banco no cuadra). El primero de la cuenta nunca es un problema.
 *   pending: pendientes del banco, sin saldo todavía (no se comprueban).
 *   withBalance: movimientos con saldo válido (para gráfico y estadísticas).
 */
export function checkBalances(txs, { windowDays = WINDOW_DAYS, windowCount = WINDOW_COUNT } = {}) {
  const candidates = txs.filter((t) => t.saldo != null && !isPending(t))
  // Cerca = a pocos días o entre los vecinos por fecha (cuentas con pocos movimientos al mes)
  const pos = new Map([...candidates].sort((a, b) => a.fechaContable.localeCompare(b.fechaContable)).map((t, i) => [t, i]))
  const near = (x, t) => daysBetween(x, t) <= windowDays || Math.abs(pos.get(x) - pos.get(t)) <= windowCount
  const bySaldo = indexBy(candidates, (t) => cents(t.saldo))
  const byPrev = indexBy(candidates, (t) => cents(t.saldo - t.importe))
  const hasPrev = (t) => findNear(bySaldo, cents(t.saldo - t.importe), t, near)
  const hasNext = (t) => findNear(byPrev, cents(t.saldo), t, near)

  // Saldo 0 de versiones anteriores = pendiente sin saldo, salvo que encaje de verdad
  const legacyPending = new Set(candidates.filter((t) => t.saldo === 0 && isImported(t) && !hasPrev(t) && !hasNext(t)))
  const withBalance = candidates.filter((t) => !legacyPending.has(t))
  const pending = txs.filter((t) => isPending(t) || legacyPending.has(t))

  const first = withBalance.reduce((a, t) => (!a || t.fechaContable < a.fechaContable ? t : a), null)
  const issues = withBalance
    .filter((t) => t !== first && !hasPrev(t))
    .sort((a, b) => a.fechaContable.localeCompare(b.fechaContable))
  return { issues, pending, withBalance }
}

/**
 * Evolución del saldo de una cuenta con extractos: los movimientos con saldo del banco y,
 * antes del primero, los apuntados a mano o traspasados desde otras cuentas, con el saldo
 * calculado hacia atrás desde el primer saldo del banco.
 * @param sorted todos los movimientos de la cuenta, por fecha
 * @param withBalance los de saldo válido (de checkBalances)
 * @returns {{ series: object[], calculated: number }} series por fecha, cada uno con `saldo`
 */
export function balanceHistory(sorted, withBalance) {
  const valid = new Set(withBalance)
  const banked = sorted.filter((t) => valid.has(t))
  if (!banked.length) return { series: [], calculated: 0 }
  const anchor = banked[0]
  const earlier = sorted.filter((t) => !valid.has(t) && !isPending(t) && t.fechaContable < anchor.fechaContable)
  let running = cents(anchor.saldo - anchor.importe)
  const computed = []
  for (let i = earlier.length - 1; i >= 0; i--) {
    computed.unshift({ ...earlier[i], saldo: running / 100 })
    running -= cents(earlier[i].importe ?? 0)
  }
  return { series: [...computed, ...banked], calculated: computed.length }
}

/**
 * Importación de cada movimiento: `importId` (desde la 0.8.0) o, en los anteriores, la marca
 * de tiempo de su id (`tx-<ms>-…`), agrupando las que caen en el mismo momento.
 */
function importBatches(txs) {
  const stamp = (t) => t.importId ?? Number(String(t.id).match(/^tx-(\d+)-/)?.[1] ?? 0)
  const stamps = [...new Set(txs.map(stamp))].sort((a, b) => a - b)
  const batchOf = new Map()
  let batch = -1, last = -Infinity
  for (const s of stamps) {
    if (s - last > 5000) batch++
    batchOf.set(s, batch)
    last = s
  }
  return (t) => batchOf.get(stamp(t))
}

/**
 * El mismo movimiento importado varias veces al solapar extractos. Dos movimientos iguales
 * del mismo extracto son reales (dos cafés iguales el mismo día); se conservan tantas copias
 * como traiga la importación que más tenga, prefiriendo la más reciente (saldos definitivos).
 * @returns {{ keep: object[], remove: object[] }[]}
 */
export function findDuplicates(txs) {
  const imported = txs.filter(isImported)
  const batchOf = importBatches(imported)
  const groups = []
  for (const list of indexBy(imported, movementKey).values()) {
    if (list.length < 2) continue
    const byBatch = indexBy(list, batchOf)
    if (byBatch.size < 2) continue
    const [, keep] = [...byBatch].sort(([ba, a], [bb, b]) => b.length - a.length || bb - ba)[0]
    if (keep.length === list.length) continue
    groups.push({ keep, remove: list.filter((t) => !keep.includes(t)) })
  }
  return groups.sort((a, b) => a.keep[0].fechaContable.localeCompare(b.keep[0].fechaContable))
}

// Fechas que el banco añade al concepto de un pendiente («WWW.AMAZON 08/11/26»)
const DATE_IN_TEXT = /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/g
const words = (s) => String(s ?? '').toUpperCase().replace(DATE_IN_TEXT, ' ').split(/[^A-Z0-9]+/).filter((w) => w && !/^\d+$/.test(w))

/**
 * ¿El mismo comercio? El pendiente suele llevar la fecha de la compra y el contabilizado una
 * referencia («WWW.AMAZON 08/11/26» → «WWW.AMAZON*BI6WF8UB4»): sin fechas ni números sueltos,
 * las palabras de uno empiezan como las del otro.
 */
export const similarText = (a, b) => {
  const x = normalize(a), y = normalize(b)
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x) || x.slice(0, 12) === y.slice(0, 12)) return true
  const wa = words(a), wb = words(b)
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa]
  return short.join('').length >= 6 && short.every((w, i) => w === long[i])
}

/** El contabilizado llega el mismo día que el pendiente o pocos días después, nunca antes. */
const bookedAfter = (pending, booked) => {
  const d = (new Date(booked.fechaContable) - new Date(pending.fechaContable)) / DAY
  return d >= 0 && d <= PENDING_MATCH_DAYS
}
const samePurchase = (pending, booked) =>
  pending.importe === booked.importe && bookedAfter(pending, booked) && similarText(pending.descripcion, booked.descripcion)

/** De los candidatos, el de fecha más cercana (con compras repetidas, como un café diario, no se cruzan). */
const closest = (candidates, ref) => candidates.reduce((best, x) => (
  !best || Math.abs(new Date(x.fechaContable) - new Date(ref.fechaContable)) < Math.abs(new Date(best.fechaContable) - new Date(ref.fechaContable)) ? x : best
), null)

/**
 * Qué hacer con las filas de un extracto frente a lo que ya hay:
 * - una fila que ya existe (misma fecha, concepto e importe) no se vuelve a añadir; se cuentan
 *   las copias, así que dos movimientos iguales del extracto siguen siendo dos,
 * - si llega con otro saldo, se queda el nuevo: completa un pendiente o corrige el saldo
 *   provisional de un extracto descargado ese mismo día,
 * - un pendiente que el banco ya ha contabilizado (mismo importe, concepto parecido, el mismo día
 *   o hasta 10 días después; el de fecha más cercana) se actualiza en vez de duplicarse; conserva
 *   categoría y notas,
 * - el banco sigue listando a veces como pendiente lo que ya ha contabilizado: un pendiente del
 *   extracto con su contabilizado (ya guardado o en este extracto) no se añade.
 * Primero las filas contabilizadas y después las pendientes, sea cual sea su orden en el extracto.
 * @returns {{ add: object[], update: { id: string, changes: object }[] }}
 */
export function planImport(existing, incoming, defaultAccountId = null) {
  const accountOf = (t) => t.accountId ?? defaultAccountId
  const imported = existing.filter(isImported)
  const pools = indexBy(imported, (t) => `${accountOf(t)}|${movementKey(t)}`)
  const pendingPool = imported.filter((t) => isPending(t) || t.saldo === 0)
  const used = new Set()
  const add = []
  const update = []
  const completed = [] // pendientes guardados que este extracto contabiliza, con sus datos nuevos

  const complete = (e, r, extra = {}) => {
    used.add(e)
    const changes = { saldo: r.saldo, fechaValor: r.fechaValor, bankRowIndex: r.bankRowIndex, pendiente: false, ...(r.importId != null ? { importId: r.importId } : {}), ...extra }
    update.push({ id: e.id, changes })
    return { ...e, ...changes }
  }

  const rowIsPending = (r) => !!r.pendiente
  for (const r of incoming.filter((r) => !rowIsPending(r))) {
    const pool = (pools.get(`${accountOf(r)}|${movementKey(r)}`) ?? []).filter((e) => !used.has(e))
    if (pool.length) {
      const e = pool.find((x) => x.saldo === r.saldo) ?? pool[0]
      // Con saldo nuevo: completa un pendiente o corrige el saldo provisional del día de la descarga
      if (r.saldo != null && e.saldo !== r.saldo) completed.push(complete(e, r))
      else used.add(e)
      continue
    }
    if (r.saldo != null) {
      const e = closest(pendingPool.filter((p) => !used.has(p) && accountOf(p) === accountOf(r) && samePurchase(p, r)), r)
      if (e) { completed.push(complete(e, r, { fechaContable: r.fechaContable, descripcion: r.descripcion })); continue }
    }
    add.push(r)
  }

  // Contabilizados que pueden «cubrir» un pendiente que el banco aún lista: los ya guardados, los
  // completados ahora y los nuevos de este extracto. Cada uno cubre como mucho un pendiente.
  const completedIds = new Set(completed.map((t) => t.id))
  const booked = [
    ...imported.filter((t) => !isPending(t) && t.saldo != null && !completedIds.has(t.id)),
    ...completed,
    ...add.filter((t) => t.saldo != null),
  ]
  const covered = new Set()
  for (const r of incoming.filter(rowIsPending)) {
    const pool = (pools.get(`${accountOf(r)}|${movementKey(r)}`) ?? []).filter((e) => !used.has(e))
    if (pool.length) { used.add(pool[0]); continue } // el mismo pendiente que ya teníamos
    const b = closest(booked.filter((x) => !covered.has(x) && accountOf(x) === accountOf(r) && samePurchase(r, x)), r)
    if (b) { covered.add(b); continue }
    add.push(r)
  }
  return { add, update }
}

/**
 * Pendientes guardados que el banco ya contabilizó y quedaron duplicados (versiones anteriores, o
 * cuando el extracto seguía listándolo como pendiente): mismo importe, concepto parecido y un
 * contabilizado el mismo día o pocos días después. Mismo formato que findDuplicates.
 * @returns {{ keep: object[], remove: object[] }[]}
 */
export function findStalePending(txs) {
  const imported = txs.filter(isImported)
  const booked = imported.filter((t) => !isPending(t) && t.saldo != null)
  const taken = new Set()
  const groups = []
  for (const p of imported.filter(isPending).sort((a, b) => a.fechaContable.localeCompare(b.fechaContable))) {
    const b = closest(booked.filter((x) => !taken.has(x) && samePurchase(p, x)), p)
    if (!b) continue
    taken.add(b)
    groups.push({ keep: [b], remove: [p] })
  }
  return groups
}
