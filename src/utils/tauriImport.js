/**
 * Dynamic import helper for Tauri plugins.
 * Each plugin is listed explicitly so Vite includes them in the bundle.
 * In the browser, the caller's try/catch handles the fallback.
 */
const PLUGINS = {
  '@tauri-apps/plugin-dialog':  () => import('@tauri-apps/plugin-dialog'),
  '@tauri-apps/plugin-fs':      () => import('@tauri-apps/plugin-fs'),
  '@tauri-apps/plugin-updater': () => import('@tauri-apps/plugin-updater'),
  '@tauri-apps/plugin-process': () => import('@tauri-apps/plugin-process'),
}

export function tauriImport(pkg) {
  const loader = PLUGINS[pkg]
  if (!loader) throw new Error(`Unknown Tauri plugin: ${pkg}`)
  return loader()
}
