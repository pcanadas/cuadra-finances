/**
 * Tamaño de letra de la app (Ajustes). Se guarda por dispositivo.
 * - Android: zoom de texto del WebView (window.CuadraTextSize, en MainActivity.kt),
 *   igual que hace el sistema: solo cambia la letra, no el resto del diseño.
 * - Escritorio / navegador: tamaño de fuente raíz (escala la página).
 */
const KEY = 'cuadra.textSize'

export const TEXT_SIZES = [
  { id: 'sistema', label: 'Como el móvil', percent: 0 },
  { id: 'pequena', label: 'Pequeña', percent: 90 },
  { id: 'normal', label: 'Normal', percent: 100 },
  { id: 'grande', label: 'Grande', percent: 115 },
]

export function getTextSize() {
  try {
    const v = localStorage.getItem(KEY)
    return TEXT_SIZES.some((t) => t.id === v) ? v : 'sistema'
  } catch {
    return 'sistema'
  }
}

function apply(id) {
  const { percent } = TEXT_SIZES.find((t) => t.id === id) ?? TEXT_SIZES[0]
  if (window.CuadraTextSize) {
    window.CuadraTextSize.set(percent)
  } else {
    document.documentElement.style.fontSize = percent ? `${percent}%` : ''
  }
}

export function setTextSize(id) {
  try { localStorage.setItem(KEY, id) } catch { /* sin almacenamiento */ }
  apply(id)
}

export function initTextSize() {
  apply(getTextSize())
}
