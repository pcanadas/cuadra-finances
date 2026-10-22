export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** "Octubre 2026" o "Año 2026" (month = null) */
export function periodLabel({ year, month }) {
  return month == null ? `Año ${year}` : `${capitalize(MONTHS[month])} ${year}`
}
