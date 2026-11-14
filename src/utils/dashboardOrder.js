/**
 * Orden de las tarjetas del Dashboard (botón «Ordenar tarjetas» al final). Se guarda por
 * dispositivo: en el móvil y en el ordenador puede interesar un orden distinto.
 */
const KEY = 'zenit.ordenDashboard'

export const DASHBOARD_CARDS = [
  { id: 'prevision', label: '📋 Previsión del mes' },
  { id: 'metas', label: '🐷 Ahorro y metas' },
  { id: 'compartidos', label: '👥 Gastos compartidos' },
  { id: 'evolucion', label: '📊 Evolución mensual' },
  { id: 'distribucion', label: '🥧 Distribución de gastos' },
  { id: 'gastosMes', label: '📅 Gastos mensuales por categoría' },
  { id: 'ingresosMes', label: '📅 Ingresos mensuales por subcategoría' },
  { id: 'anual', label: '📅 Comparativa anual' },
  { id: 'desglose', label: '🏷️ Desglose por categoría' },
]
const DEFAULT = DASHBOARD_CARDS.map((c) => c.id)

/** Orden guardado, con las tarjetas nuevas (de una versión posterior) al final. */
export function getCardOrder() {
  let saved = []
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    saved = []
  }
  if (!Array.isArray(saved)) saved = []
  const known = saved.filter((id) => DEFAULT.includes(id))
  return [...known, ...DEFAULT.filter((id) => !known.includes(id))]
}

export function setCardOrder(order) {
  try {
    if (order) localStorage.setItem(KEY, JSON.stringify(order))
    else localStorage.removeItem(KEY)
  } catch {
    // sin almacenamiento: el orden dura hasta cerrar la app
  }
}

export const defaultCardOrder = () => [...DEFAULT]
