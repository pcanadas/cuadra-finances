// Abre el alta rápida (la gestiona Navbar) desde cualquier pantalla
export const QUICK_ADD_EVENT = 'cuadra:quick-add'

/** @param {'gasto' | 'ingreso' | 'transferencia'} [tipo] tipo preseleccionado (por defecto, gasto) */
export function openQuickAdd(tipo) {
  window.dispatchEvent(new CustomEvent(QUICK_ADD_EVENT, { detail: { tipo: typeof tipo === 'string' ? tipo : undefined } }))
}

/**
 * Android: la notificación «+ Gasto / + Ingreso» y los accesos directos del icono abren la app
 * con un alta pendiente (MainActivity.kt). Se recoge al arrancar y cada vez que llega una nueva.
 */
export function listenNativeQuickAdd() {
  if (!window.CuadraQuickAdd) return () => {}
  const consume = () => {
    let tipo = ''
    try { tipo = window.CuadraQuickAdd.consume() } catch { /* sin puente */ }
    if (tipo) openQuickAdd(tipo)
  }
  consume()
  window.addEventListener('cuadra-native-quick-add', consume)
  return () => window.removeEventListener('cuadra-native-quick-add', consume)
}
