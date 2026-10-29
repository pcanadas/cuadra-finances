import { useCallback, useEffect, useRef, useState } from 'react'
import { ONLY_ON_OPEN, authenticateUser, getLockDelay, isAppLockEnabled, isAuthBusy, isAuthInProgress, setAppLockEnabled, setScreenLocked } from '../platform/appLock'

/**
 * Pantalla de bloqueo (solo Android, si está activado en Ajustes): al abrir la app y, si se ha
 * elegido, también al volver a ella tras estar fuera un tiempo. Nunca al salir. Tapa la app sin desmontarla, así no se pierde lo que estuviera
 * a medias (p. ej. un formulario).
 */
export default function AppLock({ children }) {
  const [locked, setLocked] = useState(isAppLockEnabled)
  const hiddenAt = useRef(null)

  const unlock = useCallback(async () => {
    if (isAuthBusy()) return
    const { ok, code } = await authenticateUser('Desbloquear Zenit')
    if (ok) setLocked(false)
    else if (code === 'passcodeNotSet') {
      // El móvil ya no tiene bloqueo de pantalla: no hay con qué comprobarlo y la app quedaría
      // cerrada para siempre. Se desactiva (Ajustes lo muestra apagado).
      setAppLockEnabled(false)
      setLocked(false)
    }
  }, [])

  // Iconos de la barra de estado claros sobre el fondo oscuro; al desbloquear, los del tema
  useEffect(() => { setScreenLocked(locked) }, [locked])

  // Al bloquearse, el diálogo sale solo
  useEffect(() => {
    if (!locked) return
    const id = setTimeout(unlock, 0)
    return () => clearTimeout(id)
  }, [locked, unlock])

  useEffect(() => {
    const onVisibility = () => {
      if (!isAppLockEnabled() || getLockDelay() === ONLY_ON_OPEN || isAuthInProgress()) return
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
      } else if (hiddenAt.current != null) {
        if (Date.now() - hiddenAt.current >= getLockDelay() * 1000) setLocked(true)
        hiddenAt.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <>
      <div className="contents" inert={locked} aria-hidden={locked || undefined}>{children}</div>
      {locked && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-6 px-8 text-center"
          style={{ background: '#1a2e38', paddingTop: 'var(--sat, 0px)', paddingBottom: 'var(--sab, 0px)' }}>
          <img src="/favicon.svg" alt="" className="w-20 h-20 rounded-[22%] shadow-lg" />
          <div>
            <p className="text-2xl font-bold text-white">Zenit</p>
            <p className="text-sm text-slate-300 mt-1">Bloqueado para proteger tus datos</p>
          </div>
          <button onClick={unlock} className="px-6 py-3 rounded-xl font-semibold text-white" style={{ background: '#fd802e' }}>
            🔒 Desbloquear
          </button>
        </div>
      )}
    </>
  )
}
