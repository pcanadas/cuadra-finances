import { isTransferTx } from '../utils/transferPairing'

/**
 * Planes de ahorro y metas (tabla `goals`):
 * - tipo 'ahorro': ahorrar `importeMensual` cada mes, sin fin ni finalidad concreta.
 * - tipo 'meta': reunir `objetivo` para `fechaObjetivo` ('AAAA-MM'), partiendo de `inicial`
 *   (lo que ya se tenía). La cuota de cada mes es lo que falta repartido entre los meses que
 *   quedan, así que sube si un mes no se aporta.
 * Cómo se aparta el dinero (`modo`):
 * - 'cuenta': traspasándolo a `accountId`; cuenta lo que entra en esa cuenta por traspasos
 *   desde las demás (menos lo que sale), sea importado del banco o contrapartida automática.
 * - 'apartado': sin moverlo; cuenta lo que sobra del mes (ingresos − gastos, sin traspasos y
 *   sin lo ya traspasado a cuentas de ahorro), repartido entre estos planes por orden de
 *   creación. El del mes en curso no se sabe hasta que acaba: se reserva entero.
 * Empiezan en `desde` ('AAAA-MM'); sin él, en el mes en que se crearon (`creadoEn`).
 *
 * Estado de cada mes: 'conseguido' (aportada la cuota), 'parcial' (algo), 'no conseguido'
 * (nada), 'en curso' (el mes actual) o 'meta conseguida' (meta ya reunida: cuota 0).
 */

const round2 = (n) => Math.round(n * 100) / 100
const monthIndex = (s) => { const [y, m] = String(s).slice(0, 7).split('-').map(Number); return y * 12 + m - 1 }
export const monthKey = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
export const goalStart = (g) => g.desde || (g.creadoEn ? g.creadoEn.slice(0, 7) : null)

function monthStatus(quota, contributed) {
  if (quota <= 0) return 'meta conseguida'
  if (contributed >= quota - 0.005) return 'conseguido'
  return contributed > 0 ? 'parcial' : 'no conseguido'
}

/**
 * @returns {{ results: object[], pendingThisMonth: number }}
 *   results[i]: { goal, started, months: [{ key, quota, contributed, status }], accumulated, expected,
 *                 current: { quota, contributed, status, pending } | null,
 *                 meta?: { objetivo, remaining, reached, overdue, monthsLeft } }
 *   pendingThisMonth: lo que aún hay que apartar este mes entre todos (para «Disponible para gastar»)
 */
export function evaluateGoals({ goals, transactions, transferCatIds, ingresoCatIds, defaultAccountId = null, today = new Date() }) {
  const current = today.getFullYear() * 12 + today.getMonth()
  const balance = new Map() // mes → ingresos − gastos
  const inflow = new Map()  // `${cuenta}|${mes}` → traspasos netos recibidos
  const add = (map, k, v) => map.set(k, (map.get(k) ?? 0) + v)
  for (const t of transactions) {
    if (!t.fechaContable) continue
    const i = monthIndex(t.fechaContable)
    if (i > current) continue
    if (isTransferTx(t, transferCatIds)) add(inflow, `${t.accountId ?? defaultAccountId}|${i}`, t.importe)
    else if (t.importe > 0 || !ingresoCatIds.has(t.categoria)) add(balance, i, t.importe)
  }

  const ordered = [...goals].sort((a, b) => String(a.creadoEn ?? '').localeCompare(String(b.creadoEn ?? '')) || String(a.id).localeCompare(String(b.id)))
  const state = new Map(ordered.map((g) => {
    const start = goalStart(g) ? monthIndex(goalStart(g)) : current
    return [g.id, { goal: g, start, acc: g.tipo === 'meta' ? Number(g.inicial) || 0 : 0, expected: 0, months: [] }]
  }))

  const first = Math.min(current, ...[...state.values()].map((s) => s.start))
  for (let i = first; i <= current; i++) {
    const active = ordered.map((g) => state.get(g.id)).filter((s) => s.start <= i)
    const inAccount = (s) => round2(inflow.get(`${s.goal.accountId}|${i}`) ?? 0)
    const toAccounts = active.filter((s) => s.goal.modo === 'cuenta').reduce((n, s) => n + Math.max(0, inAccount(s)), 0)
    let pool = Math.max(0, round2((balance.get(i) ?? 0) - toAccounts))

    for (const s of active) {
      const g = s.goal
      let quota
      if (g.tipo === 'meta') {
        const remaining = round2(g.objetivo - s.acc)
        quota = remaining <= 0 ? 0 : round2(remaining / Math.max(1, monthIndex(g.fechaObjetivo) - i + 1))
      } else {
        quota = Number(g.importeMensual) || 0
      }
      let contributed
      if (g.modo === 'cuenta') contributed = inAccount(s)
      else if (i === current) contributed = null // aún no se sabe lo que sobrará
      else { contributed = round2(Math.min(quota, pool)); pool = round2(pool - contributed) }

      if (contributed != null) s.acc = Math.max(0, round2(s.acc + contributed))
      s.expected = round2(s.expected + quota)
      const status = i === current && quota > 0 ? 'en curso' : monthStatus(quota, contributed ?? 0)
      s.months.push({ key: monthKey(i), quota, contributed, status })
    }
  }

  let pendingThisMonth = 0
  const results = ordered.map((g) => {
    const s = state.get(g.id)
    const last = s.months.at(-1)
    const current_ = last && last.key === monthKey(current) ? last : null
    let pending = 0
    if (current_) pending = g.modo === 'cuenta' ? Math.max(0, round2(current_.quota - (current_.contributed ?? 0))) : current_.quota
    pendingThisMonth += pending
    const result = {
      goal: g,
      started: s.start <= current,
      months: s.months,
      accumulated: s.acc,
      expected: s.expected,
      current: current_ && { ...current_, pending },
    }
    if (g.tipo === 'meta') {
      const remaining = Math.max(0, round2(g.objetivo - s.acc))
      const target = monthIndex(g.fechaObjetivo)
      result.meta = { objetivo: g.objetivo, remaining, reached: remaining === 0, overdue: remaining > 0 && current > target, monthsLeft: Math.max(0, target - current + 1) }
    }
    return result
  })
  return { results, pendingThisMonth: round2(pendingThisMonth) }
}
