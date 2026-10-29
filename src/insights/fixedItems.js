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

const round2 = (n) => Math.round(n * 100) / 100
const PAID_RATIO = 0.97 // sumando varios movimientos, se da por pagado al llegar al 97 %

/**
 * Estado de los fijos que tocan este mes: `{ ...item, isIncome, paid, partial, paidAmount }`.
 * 1. Un movimiento que encaja con el fijo (findFixedPayment): pagado con ese importe.
 * 2. Si no lo hay y tiene categoría o subcategoría: lo que suman sus movimientos del mes (una
 *    nómina en dos partes, la compra del súper en muchas veces). Si varios fijos comparten
 *    categoría, se reparte por orden.
 * El último fijo de cada categoría se queda además con lo que sobre (se ve si te has pasado).
 * Cada movimiento cuenta para un solo fijo.
 * @param monthTx movimientos del mes, sin traspasos
 */
export function fixedStatusForMonth(dueItems, monthTx, ingresoCatIds) {
  const items = dueItems.map((r) => ({ r, isIncome: ingresoCatIds.has(r.categoriaId) }))
  const claimed = new Set()
  const single = new Map()
  for (const { r, isIncome } of items) {
    const match = findFixedPayment(r, monthTx.filter((t) => !claimed.has(t)), isIncome)
    if (match) { claimed.add(match); single.set(r, match) }
  }

  // Movimientos de una subcategoría con fijo propio no cuentan para el fijo de su categoría
  const ownSubcats = new Set(dueItems.filter((r) => r.subcategoriaId).map((r) => r.subcategoriaId))
  const poolKey = (r, isIncome) => `${isIncome ? '+' : '-'}|${r.subcategoriaId ? `s:${r.subcategoriaId}` : `c:${r.categoriaId}`}`
  const remaining = new Map()
  const left = new Map() // fijos sin pagar aún por repartir en cada bolsa
  for (const { r, isIncome } of items) {
    if (!r.subcategoriaId && !r.categoriaId) continue
    const key = poolKey(r, isIncome)
    left.set(key, (left.get(key) ?? 0) + 1)
    if (remaining.has(key)) continue
    const inPool = (t) => r.subcategoriaId ? t.subcategoria === r.subcategoriaId : t.categoria === r.categoriaId && !ownSubcats.has(t.subcategoria)
    const total = monthTx
      .filter((t) => !claimed.has(t) && (isIncome ? t.importe > 0 : t.importe < 0) && inPool(t))
      .reduce((s, t) => s + Math.abs(t.importe), 0)
    remaining.set(key, round2(total))
  }

  return items.map(({ r, isIncome }) => {
    const match = single.get(r)
    if (!r.subcategoriaId && !r.categoriaId) {
      return { ...r, isIncome, paid: !!match, partial: false, paidAmount: match ? Math.abs(match.importe) : null }
    }
    const key = poolKey(r, isIncome)
    const avail = remaining.get(key)
    const last = left.get(key) === 1
    left.set(key, left.get(key) - 1)
    const fromPool = round2(last ? avail : match ? 0 : Math.min(avail, r.importe))
    remaining.set(key, round2(avail - fromPool))
    const amount = round2((match ? Math.abs(match.importe) : 0) + fromPool)
    const paid = !!match || amount >= r.importe * PAID_RATIO
    return { ...r, isIncome, paid, partial: !paid && amount > 0, paidAmount: amount > 0 ? amount : null }
  })
}
