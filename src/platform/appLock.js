import { isAndroid, isTauri } from './index'

/**
 * Bloqueo de la app con la huella/cara o el bloqueo de pantalla del móvil (PIN, patrón o
 * contraseña), con el diálogo del sistema (plugin biometric). Zenit no guarda ninguna
 * contraseña ni dato biométrico: Android solo dice si la persona se ha identificado.
 * Solo en Android. Ajustes del dispositivo: no van en las copias ni se sincronizan.
 */

const ENABLED_KEY = 'cuadra.lock.enabled'
const DELAY_KEY = 'cuadra.lock.delay'

export const canUseAppLock = isTauri && isAndroid

/** Tras cuántos segundos fuera de la app se vuelve a pedir. */
export const LOCK_DELAYS = [
  { value: 0, label: 'Nada más salir' },
  { value: 60, label: 'Tras 1 minuto' },
  { value: 300, label: 'Tras 5 minutos' },
  { value: 900, label: 'Tras 15 minutos' },
]
const DEFAULT_DELAY = 60

const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento */ } }

export const isAppLockEnabled = () => canUseAppLock && read(ENABLED_KEY) === '1'
export const setAppLockEnabled = (on) => write(ENABLED_KEY, on ? '1' : '0')
export function getLockDelay() {
  const raw = read(DELAY_KEY)
  return raw != null && LOCK_DELAYS.some((d) => d.value === Number(raw)) ? Number(raw) : DEFAULT_DELAY
}
export const setLockDelay = (seconds) => write(DELAY_KEY, String(seconds))

// El diálogo del sistema abre otra pantalla: la app pasa a segundo plano y vuelve. Mientras
// dura (y un momento después) eso no debe contar como salir de la app.
let busy = false
let quietUntil = 0
export const isAuthInProgress = () => busy || Date.now() < quietUntil
export const isAuthBusy = () => busy

/**
 * Pide identificarse. `title` es la acción («Desbloquear Zenit»); Android ya muestra encima el
 * nombre de la app, así que no se repite. @returns {Promise<{ ok: boolean, code?: string }>}
 * code 'passcodeNotSet': el móvil no tiene bloqueo de pantalla; 'userCancel': cancelado.
 */
export async function authenticateUser(title) {
  if (!canUseAppLock) return { ok: true }
  busy = true
  try {
    const { authenticate } = await import('@tauri-apps/plugin-biometric')
    await authenticate('Usa el bloqueo de pantalla de tu móvil', { allowDeviceCredential: true, title })
    return { ok: true }
  } catch (e) {
    return { ok: false, code: e?.code ?? (typeof e === 'string' ? e : undefined) }
  } finally {
    busy = false
    quietUntil = Date.now() + 2000
  }
}

/** «huella», «cara»… para los textos; null si solo hay PIN/patrón o no se sabe. */
export async function biometryName() {
  if (!canUseAppLock) return null
  try {
    const { checkStatus, BiometryType } = await import('@tauri-apps/plugin-biometric')
    const s = await checkStatus()
    if (!s.isAvailable) return null
    return { [BiometryType.TouchID]: 'huella', [BiometryType.FaceID]: 'cara', [BiometryType.Iris]: 'iris' }[s.biometryType] ?? null
  } catch {
    return null
  }
}
