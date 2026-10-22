import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { isAndroid, isTauri } from './index'

/**
 * Gesto/botón atrás de Android (§5.4).
 * Orden: 1) cierra lo último abierto (hojas, modales) → 2) navega atrás → 3) en Inicio, sale.
 */

// Pila de manejadores: el último registrado es el que está "encima"
const stack = []

/** Mientras `active` sea true, el botón atrás llama a `onBack` en vez de navegar. */
export function useBackHandler(active, onBack) {
  const ref = useRef(onBack)
  useLayoutEffect(() => { ref.current = onBack })

  useEffect(() => {
    if (!active) return
    const entry = () => ref.current()
    stack.push(entry)
    return () => {
      const i = stack.lastIndexOf(entry)
      if (i !== -1) stack.splice(i, 1)
    }
  }, [active])
}

/** Se monta una vez dentro del router. No hace nada fuera de Android. */
export function useAndroidBackButton() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const pathRef = useRef(pathname)
  useLayoutEffect(() => { pathRef.current = pathname })

  useEffect(() => {
    if (!isTauri || !isAndroid) return
    let listener
    let cancelled = false

    import('@tauri-apps/api/app').then(async ({ onBackButtonPress, exit }) => {
      const l = await onBackButtonPress(({ canGoBack }) => {
        if (stack.length) return stack[stack.length - 1]()
        if (pathRef.current === '/') return exit(0)
        if (canGoBack) window.history.back()
        else navigate('/', { replace: true })
      })
      if (cancelled) l.unregister()
      else listener = l
    })

    return () => {
      cancelled = true
      listener?.unregister()
    }
  }, [navigate])
}
