/**
 * Tamaño de letra de la app (Ajustes). Se guarda por dispositivo como porcentaje;
 * sin valor guardado se usa el del sistema.
 * - Android: zoom de texto del WebView (window.CuadraTextSize, en MainActivity.kt),
 *   igual que hace el sistema: solo cambia la letra, no el resto del diseño.
 * - Escritorio / navegador: tamaño de fuente raíz (escala la página).
 */
const KEY = 'cuadra.textSize'

export const TEXT_SIZE_MIN = 80
export const TEXT_SIZE_MAX = 150
export const TEXT_SIZE_STEP = 5

/** Tamaño del sistema en % (Android: escala de fuente del móvil; resto: 100). */
export function getSystemTextSize() {
  try {
    return window.CuadraTextSize?.getSystem?.() || 100
  } catch {
    return 100
  }
}

/** Porcentaje guardado, o null si se sigue al sistema. */
function getStored() {
  try {
    const v = parseInt(localStorage.getItem(KEY), 10)
    return v >= TEXT_SIZE_MIN && v <= TEXT_SIZE_MAX ? v : null
  } catch {
    return null
  }
}

/** Tamaño efectivo en %. */
export function getTextSize() {
  return getStored() ?? getSystemTextSize()
}

function apply(percent) {
  if (window.CuadraTextSize) {
    window.CuadraTextSize.set(percent ?? 0)
  } else {
    document.documentElement.style.fontSize = percent ? `${percent}%` : ''
  }
}

/** Guarda y aplica un tamaño; si coincide con el del sistema, vuelve a seguirlo. */
export function setTextSize(percent) {
  const follow = percent === getSystemTextSize()
  try {
    if (follow) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, String(percent))
  } catch { /* sin almacenamiento */ }
  apply(follow ? null : percent)
}

export function initTextSize() {
  apply(getStored())
}
