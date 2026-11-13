/**
 * Qué cuenta como ingreso y qué como gasto (sin traspasos, que se filtran aparte):
 * - ingreso: todo lo positivo y, además, lo negativo de una categoría de ingreso, que resta
 *   (p. ej. devolver una nómina cobrada de más),
 * - gasto: lo negativo de cualquier otra categoría.
 * Los ingresos se suman con su signo; los gastos, en positivo.
 */
export const isIncomeTx = (t, ingresoCatIds) => t.importe > 0 || (t.importe < 0 && ingresoCatIds.has(t.categoria))
export const isExpenseTx = (t, ingresoCatIds) => t.importe < 0 && !ingresoCatIds.has(t.categoria)
