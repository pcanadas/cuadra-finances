/**
 * Detección de plataforma.
 * Síncrona para poder usarse al renderizar; el user agent del WebView de Android
 * siempre incluye "Android", así que no hace falta plugin-os.
 */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
export const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
export const isMobile = isAndroid

// En móvil las actualizaciones llegan por Google Play
export const canAutoUpdate = isTauri && !isMobile
