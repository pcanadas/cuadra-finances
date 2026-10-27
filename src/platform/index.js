/**
 * Detección de plataforma.
 * Síncrona para poder usarse al renderizar; el user agent del WebView de Android
 * siempre incluye "Android", así que no hace falta plugin-os.
 */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
export const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
export const isMobile = isAndroid

// Versión de Microsoft Store (npm run store:build): las actualizaciones las da la Store
export const isStore = import.meta.env.VITE_STORE === '1'

// En móvil las actualizaciones llegan por Google Play, y en la Store por la Store
export const canAutoUpdate = isTauri && !isMobile && !isStore

// Para textos como «tus datos solo están en este móvil / ordenador»
export const deviceName = isMobile ? 'móvil' : 'ordenador'
