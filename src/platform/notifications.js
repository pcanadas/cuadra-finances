/**
 * Notificación fija con «+ Gasto» / «+ Ingreso» (solo Android, se activa en Ajustes).
 * La gestiona MainActivity.kt (window.CuadraNotify); activarla puede pedir permiso al
 * usuario, así que el resultado llega después con el evento "cuadra-notify".
 */
export const NOTIFY_EVENT = 'cuadra-notify'

export const hasQuickAddNotification = () => typeof window !== 'undefined' && !!window.CuadraNotify

/** @returns {{ enabled: boolean, allowed: boolean }} allowed = la app puede mostrar notificaciones */
export function getQuickAddNotification() {
  try {
    return JSON.parse(window.CuadraNotify.state())
  } catch {
    return { enabled: false, allowed: false }
  }
}

export function setQuickAddNotification(on) {
  if (on) window.CuadraNotify?.enable()
  else window.CuadraNotify?.disable()
}

export function openNotificationSettings() {
  window.CuadraNotify?.openSettings()
}
