/**
 * Márgenes de las barras del sistema como variables CSS: --sat, --sar, --sab, --sal.
 * Por defecto valen env(safe-area-inset-*) (ver index.css). En Android, MainActivity.kt
 * expone los valores reales en window.CuadraInsets (el WebView de Android < 15 no los
 * da en env()), y avisa de cambios con el evento "cuadra-insets".
 */
export function initInsets() {
  const native = typeof window !== 'undefined' && window.CuadraInsets
  if (!native) return

  const apply = () => {
    try {
      const { top, right, bottom, left } = JSON.parse(native.get())
      const s = document.documentElement.style
      s.setProperty('--sat', `${top}px`)
      s.setProperty('--sar', `${right}px`)
      s.setProperty('--sab', `${bottom}px`)
      s.setProperty('--sal', `${left}px`)
    } catch {
      // Sin datos nativos: se quedan los valores de env()
    }
  }

  apply()
  window.addEventListener('cuadra-insets', apply)
  window.addEventListener('resize', apply)
}
