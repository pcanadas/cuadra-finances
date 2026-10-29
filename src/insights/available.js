import { isTransferTx } from '../utils/transferPairing'
import { activeInMonth, fixedStatusForMonth, isDueInMonth } from './fixedItems'

const sum = (list) => list.reduce((s, x) => s + x, 0)
const round2 = (n) => Math.round(n * 100) / 100
const MIN_HISTORY_MONTHS = 2
const AVERAGE_MONTHS = 3

/**
 * Disponible para gastar hasta fin del mes en curso:
 *   ingresos previstos − ya gastado − gastos fijos aún sin pagar − lo que falta por apartar este mes
 *   para ahorro y metas (`savings`, ver goals.js), repartido entre los días que quedan.
 *
 * Ingresos previstos:
 * - con ingresos fijos que tocan este mes: lo ya recibido + los fijos aún no cobrados,
 * - sin ellos: lo ya recibido o, si es menos, la media de ingresos de los últimos meses
 *   completos (al menos 2 con movimientos; la nómina suele llegar a final de mes),
 * - sin historial suficiente: lo ya recibido.
 * Gastos e ingresos se cuentan como en el Dashboard: sin traspasos entre cuentas propias.
 *
 * @returns {null | {
 *   total: number, perDay: number, daysLeft: number,
 *   income: { expected: number, received: number, pendingFixed: number, average: number|null, months: number, basis: 'fijos'|'media'|'recibidos' },
 *   spent: number, pendingFixed: number, pendingFixedCount: number, savings: number
 * }} null si no hay nada que prever (sin ingresos ni historial)
 */
export function availableToSpend({ transactions, transferCatIds, ingresoCatIds, recurringItems = [], savings = 0, today = new Date() }) {
  const year = today.getFullYear()
  const month = today.getMonth()
  const monthKey = (y, m) => y * 12 + m
  const current = monthKey(year, month)

  const byMonth = new Map()
  for (const t of transactions) {
    if (isTransferTx(t, transferCatIds)) continue
    const d = new Date(t.fechaContable)
    const k = monthKey(d.getFullYear(), d.getMonth())
    if (k > current) continue
    if (!byMonth.has(k)) byMonth.set(k, [])
    byMonth.get(k).push(t)
  }
  const monthTx = byMonth.get(current) ?? []
  const incomeOf = (list) => sum(list.filter((t) => t.importe > 0).map((t) => t.importe))

  const received = incomeOf(monthTx)
  const spent = sum(monthTx.filter((t) => t.importe < 0 && !ingresoCatIds.has(t.categoria)).map((t) => -t.importe))

  const due = activeInMonth(recurringItems, year, month).filter((r) => isDueInMonth(r, month))
  const status = fixedStatusForMonth(due, monthTx, ingresoCatIds)
  // De lo que aún no está pagado, lo que falta (si ya ha llegado una parte, solo el resto)
  const stillDue = (r) => Math.max(0, r.importe - (r.paidAmount ?? 0))
  const pendingIncome = sum(status.filter((r) => r.isIncome && !r.paid).map(stillDue))
  const pendingExpenses = status.filter((r) => !r.isIncome && !r.paid)
  const pendingFixed = sum(pendingExpenses.map(stillDue))

  // Media de ingresos de los últimos meses completos con movimientos
  const previous = [...byMonth.keys()].filter((k) => k < current).sort((a, b) => b - a).slice(0, AVERAGE_MONTHS)
  const average = previous.length >= MIN_HISTORY_MONTHS ? sum(previous.map((k) => incomeOf(byMonth.get(k)))) / previous.length : null

  let expected, basis
  if (status.some((r) => r.isIncome)) {
    expected = received + pendingIncome
    basis = 'fijos'
  } else if (average != null && average > received) {
    expected = average
    basis = 'media'
  } else {
    expected = received
    basis = 'recibidos'
  }
  if (expected === 0 && !monthTx.length && average == null) return null

  const daysLeft = new Date(year, month + 1, 0).getDate() - today.getDate() + 1
  const total = round2(expected - spent - pendingFixed - savings)
  return {
    total,
    perDay: total > 0 ? round2(total / daysLeft) : 0,
    daysLeft,
    income: { expected: round2(expected), received: round2(received), pendingFixed: round2(pendingIncome), average: average == null ? null : round2(average), months: previous.length, basis },
    spent: round2(spent),
    pendingFixed: round2(pendingFixed),
    pendingFixedCount: pendingExpenses.length,
    savings: round2(savings),
  }
}
