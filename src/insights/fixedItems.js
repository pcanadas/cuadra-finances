/**
 * Gastos e ingresos fijos (tabla recurringExpenses): cuándo tocan y si ya están pagados.
 */

export const PERIOD_MONTHS = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }

/** ¿Toca en el mes indicado (0-11)? `mesReferencia` es el primer mes en que se cobra. */
export function isDueInMonth(item, month) {
  if (item.periodicidad === 'mensual') return true
  const ref = item.mesReferencia ?? 0
  const interval = PERIOD_MONTHS[item.periodicidad] || 1
  return ((month - ref) % 12 + 12) % 12 % interval === 0
}

/** Activos y sin terminar en ese mes (fechaFin posterior o igual al día 1). */
export function activeInMonth(items, year, month) {
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  return items.filter((r) => r.activo && (!r.fechaFin || r.fechaFin >= monthStart))
}

/**
 * Movimiento del mes que corresponde a un fijo: por subcategoría, por categoría o, sin
 * ninguna, por las palabras de su nombre; con un importe parecido (±30 %).
 * @param monthTx movimientos del mes, sin traspasos
 */
export function findFixedPayment(item, monthTx, isIncome) {
  const pool = monthTx.filter((t) => (isIncome ? t.importe > 0 : t.importe < 0))
  const tolerant = (t) => Math.abs(Math.abs(t.importe) - item.importe) < item.importe * 0.3
  if (item.subcategoriaId) return pool.find((t) => t.subcategoria === item.subcategoriaId && tolerant(t)) ?? null
  if (item.categoriaId) return pool.find((t) => t.categoria === item.categoriaId && tolerant(t)) ?? null
  const words = item.nombre.toUpperCase().split(/\s+/).filter((w) => w.length >= 4)
  if (!words.length) return null
  return pool.find((t) => {
    const d = (t.descripcion || '').toUpperCase()
    return words.every((w) => d.includes(w)) && tolerant(t)
  }) ?? null
}

/** Estado de los fijos que tocan este mes: `{ ...item, isIncome, paid, paidAmount }`. */
export function fixedStatusForMonth(dueItems, monthTx, ingresoCatIds) {
  return dueItems.map((r) => {
    const isIncome = ingresoCatIds.has(r.categoriaId)
    const match = findFixedPayment(r, monthTx, isIncome)
    return { ...r, isIncome, paid: !!match, paidAmount: match ? Math.abs(match.importe) : null }
  })
}
