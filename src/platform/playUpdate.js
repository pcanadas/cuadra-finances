import { isAndroid } from './index'

/**
 * Versión nueva en Google Play (in-app updates, MainActivity.kt → window.CuadraUpdate).
 * Solo responde si la app se instaló desde Play; si no, la comprobación da error y no se avisa.
 */
export const canPlayUpdate = isAndroid && typeof window !== 'undefined' && !!window.CuadraUpdate

/** @returns {Promise<{ available: boolean, versionCode?: number, error?: boolean }>} */
export function checkPlayUpdate() {
  return new Promise((resolve) => {
    const bridge = window.CuadraUpdate
    if (!bridge) return resolve({ available: false, error: true })
    const done = (result) => {
      window.removeEventListener('cuadra-update', onResult)
      clearTimeout(timer)
      resolve(result)
    }
    const onResult = () => {
      try { done(JSON.parse(bridge.state())) } catch { done({ available: false, error: true }) }
    }
    const timer = setTimeout(() => done({ available: false, error: true }), 15000)
    window.addEventListener('cuadra-update', onResult)
    bridge.check()
  })
}

/** Abre la actualización de Google Play (o la ficha de Zenit en Play Store). */
export function startPlayUpdate() {
  window.CuadraUpdate?.start()
}
