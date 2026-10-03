/**
 * Dynamic import helper that bypasses Vite's static import analysis.
 * In Tauri these resolve normally; in the browser they throw and the
 * caller's try/catch handles the fallback.
 */
// eslint-disable-next-line no-new-func
const dynamicImport = new Function('pkg', 'return import(pkg)')

export function tauriImport(pkg) {
  return dynamicImport(pkg)
}
