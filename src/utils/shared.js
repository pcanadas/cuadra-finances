/**
 * Gastos compartidos (sección «Gastos compartidos»): gastos que pagas tú pero que en parte son de
 * otra persona (la pareja, el piso, un viaje…). Zenit cuenta solo tu parte; quién debe a quién se
 * sigue llevando fuera (Splitwise o similar).
 *
 * - Un gasto compartido guarda en el propio movimiento —o en una partida de su desglose, ver
 *   splits.js— `compartido: { miParte, pct, con }`: `miParte` con el mismo signo que el importe
 *   (0 si todo es de la otra persona), `pct` el porcentaje elegido (null si se dio un importe) y
 *   `con` con quién se comparte (opcional).
 * - Un reembolso (la otra persona te devuelve su parte por Bizum o transferencia) guarda
 *   `reembolso: { de }`: no es un ingreso tuyo, así que no cuenta en las estadísticas.
 *
 * El movimiento no cambia (sigue cuadrando con el banco): `forStats` da la vista para las
 * estadísticas, con las partidas desglosadas, solo tu parte de cada compartido y sin reembolsos.
 */
import { expandSplits, hasSplit } from './splits'

const round2 = (n) => Math.round(n * 100) / 100

export const isRefund = (t) => !!t?.reembolso
export const isSharedPart = (p) => !!p?.compartido

/** ¿El movimiento (o alguna de sus partidas) es un gasto compartido? */
export const isSharedTx = (t) => isSharedPart(t) || (hasSplit(t) && t.desglose.some(isSharedPart))

/** Reparto para un importe: por porcentaje, o por importe fijo sin pasarse del total. */
export function makeShare({ importe, pct = null, miParte = null, con = '' }) {
  const sign = importe < 0 ? -1 : 1
  const total = Math.abs(importe)
  const mine = pct != null ? total * pct / 100 : Math.min(Math.abs(miParte ?? 0), total)
  return { miParte: sign * round2(mine), pct: pct != null ? pct : null, con: String(con ?? '').trim() }
}

/** Ajusta un reparto cuando cambia el importe (p. ej. al editar un desglose). */
export function rescaleShare(share, importe) {
  if (!share) return share
  return makeShare({ importe, pct: share.pct, miParte: share.miParte, con: share.con })
}

/** Movimientos ya desglosados: solo tu parte de cada compartido y sin reembolsos. */
export function applyShares(transactions) {
  if (!transactions.some((t) => t.compartido || t.reembolso)) return transactions
  return transactions.filter((t) => !isRefund(t)).map((t) => (t.compartido
    ? { ...t, importe: t.compartido.miParte, importeTotal: t.importe }
    : t))
}

/** La vista de los movimientos para estadísticas (Dashboard, gastos fijos, ahorro y metas…). */
export const forStats = (transactions) => applyShares(expandSplits(transactions))

/**
 * Los gastos compartidos, uno por movimiento o partida:
 * `{ tx, part (índice o null), fecha, descripcion, notas, categoria, total, miParte, otros, pct, con }`
 * con los importes en positivo.
 */
export function sharedItems(transactions) {
  const items = []
  for (const tx of transactions) {
    const parts = hasSplit(tx) ? tx.desglose.map((p, i) => [p, i]) : [[tx, null]]
    for (const [p, i] of parts) {
      if (!p.compartido) continue
      const total = Math.abs(p.importe)
      const mine = Math.abs(p.compartido.miParte)
      items.push({
        tx, part: i, fecha: tx.fechaContable, descripcion: tx.descripcion, notas: p.notas || (i == null ? '' : tx.notas) || '',
        categoria: p.categoria, total, miParte: mine, otros: round2(total - mine), pct: p.compartido.pct, con: p.compartido.con || '',
      })
    }
  }
  return items
}

/** Los reembolsos: `{ tx, fecha, descripcion, importe, de }`. */
export function refundItems(transactions) {
  return transactions.filter(isRefund).map((tx) => ({ tx, fecha: tx.fechaContable, descripcion: tx.descripcion, importe: tx.importe, de: tx.reembolso.de || '' }))
}

/**
 * Resumen de un periodo: lo pagado en compartidos, tu parte, la parte de los demás (lo que has
 * adelantado) y lo que te han devuelto; también por persona (sin nombre: '').
 */
export function sharedSummary(items, refunds) {
  const byPerson = new Map()
  const person = (name) => {
    if (!byPerson.has(name)) byPerson.set(name, { nombre: name, adelantado: 0, devuelto: 0 })
    return byPerson.get(name)
  }
  let pagado = 0, miParte = 0, otros = 0, devuelto = 0
  for (const it of items) {
    pagado += it.total; miParte += it.miParte; otros += it.otros
    person(it.con).adelantado += it.otros
  }
  for (const r of refunds) {
    devuelto += r.importe
    person(r.de).devuelto += r.importe
  }
  const personas = [...byPerson.values()]
    .map((p) => ({ ...p, adelantado: round2(p.adelantado), devuelto: round2(p.devuelto) }))
    .sort((a, b) => (a.nombre === '') - (b.nombre === '') || a.nombre.localeCompare(b.nombre, 'es'))
  return { pagado: round2(pagado), miParte: round2(miParte), otros: round2(otros), devuelto: round2(devuelto), personas }
}

/** Nombres ya usados (para sugerirlos al escribir). */
export function knownPeople(transactions) {
  const names = new Set()
  for (const it of sharedItems(transactions)) if (it.con) names.add(it.con)
  for (const r of refundItems(transactions)) if (r.de) names.add(r.de)
  return [...names].sort((a, b) => a.localeCompare(b, 'es'))
}
