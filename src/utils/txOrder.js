/**
 * Orden cronológico de los movimientos, también dentro de un mismo día, para que el saldo de cada
 * uno siga al del anterior como en el extracto del banco:
 * 1. por fecha,
 * 2. dentro de cada día y cuenta, siguiendo la cadena de saldos: empieza el movimiento cuyo saldo
 *    anterior (saldo − importe) no es el saldo de ningún otro del día, y cada siguiente es el que
 *    parte del saldo del anterior. Los pendientes y los que no tienen saldo van al final del día,
 * 3. sin cadena (cuentas sin saldo, movimientos manuales…), por su posición en el extracto
 *    (`bankRowIndex`) según el sentido de cada importación —Bankinter da primero lo más reciente,
 *    otros bancos lo más antiguo—, después por importación y, por último, por id.
 */

const cents = (n) => Math.round((n ?? 0) * 100)
const hasBalance = (t) => t.saldo != null && !t.pendiente

/** ¿Cada importación lista lo más reciente primero? importId → true/false. */
function importDirections(transactions) {
  const byImport = new Map()
  for (const t of transactions) {
    if (t.importId == null || t.bankRowIndex == null || t.pendiente) continue
    if (!byImport.has(t.importId)) byImport.set(t.importId, [])
    byImport.get(t.importId).push(t)
  }
  const newestFirst = new Map()
  for (const [id, rows] of byImport) {
    rows.sort((a, b) => a.bankRowIndex - b.bankRowIndex)
    let dir = null
    const first = rows[0].fechaContable, last = rows[rows.length - 1].fechaContable
    if (first !== last) dir = first > last
    // Todas del mismo día: por el saldo de dos filas seguidas
    for (let i = 0; dir == null && i < rows.length - 1; i++) {
      const a = rows[i], b = rows[i + 1]
      if (a.saldo == null || b.saldo == null) continue
      if (cents(b.saldo) === cents(a.saldo - a.importe)) dir = true
      else if (cents(a.saldo) === cents(b.saldo - b.importe)) dir = false
    }
    newestFirst.set(id, dir ?? true)
  }
  return newestFirst
}

/** Puesto de cada movimiento dentro de su día siguiendo la cadena de saldos. */
function dayRanks(group, baseCompare) {
  const base = [...group].sort(baseCompare)
  const chained = base.filter(hasBalance)
  const rest = base.filter((t) => !hasBalance(t))
  const bySaldo = new Map()
  for (const t of chained) {
    const k = cents(t.saldo)
    if (!bySaldo.has(k)) bySaldo.set(k, [])
    bySaldo.get(k).push(t)
  }
  const prevOf = (t) => cents(t.saldo - t.importe)
  const used = new Set()
  const order = []
  const follow = (t) => {
    let cur = t
    while (cur) {
      used.add(cur)
      order.push(cur)
      const next = chained.find((x) => !used.has(x) && prevOf(x) === cents(cur.saldo))
      cur = next ?? null
    }
  }
  // Empiezan los que no parten del saldo de otro movimiento del día
  for (const t of chained) {
    if (used.has(t)) continue
    const fromOther = (bySaldo.get(prevOf(t)) ?? []).some((x) => x !== t && !used.has(x))
    if (!fromOther) follow(t)
  }
  for (const t of chained) if (!used.has(t)) follow(t) // ciclos o saldos repetidos
  order.push(...rest)
  return new Map(order.map((t, i) => [t, i]))
}

/** Comparador cronológico (más antiguo primero) para la lista dada. */
export function chronoComparator(transactions, defaultAccountId = null) {
  const newestFirst = importDirections(transactions)
  const accountOf = (t) => t.accountId ?? defaultAccountId
  const baseCompare = (a, b) => {
    if (a.importId != null && a.importId === b.importId && a.bankRowIndex != null && b.bankRowIndex != null) {
      const r = a.bankRowIndex - b.bankRowIndex
      if (r) return newestFirst.get(a.importId) ? -r : r
    }
    const i = (a.importId ?? 0) - (b.importId ?? 0)
    if (i) return i
    return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0
  }

  const groups = new Map()
  for (const t of transactions) {
    const k = `${t.fechaContable}|${accountOf(t)}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(t)
  }
  const rank = new Map()
  for (const g of groups.values()) {
    if (g.length < 2) continue
    for (const [t, r] of dayRanks(g, baseCompare)) rank.set(t, r)
  }

  return (a, b) => {
    const d = String(a.fechaContable ?? '').localeCompare(String(b.fechaContable ?? ''))
    if (d) return d
    if (accountOf(a) === accountOf(b) && rank.has(a) && rank.has(b)) return rank.get(a) - rank.get(b)
    return baseCompare(a, b)
  }
}

/** Ordena una copia de la lista de más antiguo a más reciente. */
export function sortChrono(transactions, defaultAccountId = null) {
  return [...transactions].sort(chronoComparator(transactions, defaultAccountId))
}
