/**
 * Predicción «al ritmo actual» para el Resumen del Dashboard: con lo que llevas gastado, ¿cuánto
 * ahorrarás al terminar el periodo? Es una extrapolación de tu ritmo, distinta de la Previsión del
 * mes (que parte de tus gastos e ingresos fijos, ver available.js).
 */

const round2 = (n) => Math.round(n * 100) / 100

/** % de los ingresos que no se ha gastado; null sin ingresos. */
export function savingsRate(income, net) {
  if (!(income > 0)) return null
  return Math.round((net / income) * 100)
}

/**
 * Mes en curso. El ritmo se calcula solo con el gasto variable (lo gastado menos lo pagado de los
 * gastos fijos), porque el alquiler o un seguro no se repiten cada día; los fijos que faltan se
 * suman aparte.
 *   ahorro = ingresos previstos − gastado − gasto variable al día × días que quedan − fijos pendientes
 */
export function projectMonth({ incomeExpected, spent, fixedPaid = 0, pendingFixed = 0, day, daysInMonth }) {
  if (!(day > 0)) return null
  const variable = Math.max(0, spent - fixedPaid)
  const perDay = variable / day
  const daysLeft = Math.max(0, daysInMonth - day)
  const projectedSpend = spent + perDay * daysLeft + pendingFixed
  return { perDay: round2(perDay), daysLeft, projectedSpend: round2(projectedSpend), savings: round2(incomeExpected - projectedSpend) }
}

/** Año en curso: ingresos y gastos al ritmo medio diario de lo que va de año. */
export function projectYear({ income, spent, day, daysInYear }) {
  if (!(day > 0)) return null
  const factor = daysInYear / day
  return { perDay: round2(spent / day), savings: round2((income - spent) * factor) }
}
