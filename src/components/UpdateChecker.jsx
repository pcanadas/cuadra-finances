import { useEffect, useState } from 'react'
import { tauriImport } from '../utils/tauriImport'
import { checkPlayUpdate, startPlayUpdate } from '../platform/playUpdate'

// Only runs inside Tauri — gracefully does nothing in browser
export default function UpdateChecker() {
  const [update, setUpdate]   = useState(null)
  const [status, setStatus]   = useState(null) // null | 'downloading' | 'done' | 'error'
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        // Dynamic import so the browser build doesn't fail if the module isn't present
        const { check } = await tauriImport('@tauri-apps/plugin-updater')
        const upd = await check()
        if (!cancelled && upd?.available) setUpdate(upd)
      } catch {
        // Not running inside Tauri or no update server configured — silently ignore
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  if (!update || dismissed) return null

  async function handleInstall() {
    setStatus('downloading')
    try {
      await update.downloadAndInstall()
      setStatus('done')
      // NSIS installer handles relaunch — just exit so it can replace the files
      const { exit } = await tauriImport('@tauri-apps/plugin-process')
      await exit(0)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-indigo-200 rounded-2xl shadow-lg p-4 max-w-sm">
      <p className="text-sm font-semibold text-slate-800 mb-1">
        Nueva versión disponible — {update.version}
      </p>
      {update.body && (
        <p className="text-xs text-slate-500 mb-3 line-clamp-3">{update.body}</p>
      )}
      {status === 'downloading' && (
        <p className="text-xs text-indigo-600 animate-pulse">Descargando actualización…</p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-600">Error al descargar. Inténtalo más tarde.</p>
      )}
      {!status && (
        <div className="flex gap-2">
          <button onClick={handleInstall}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
            Actualizar ahora
          </button>
          <button onClick={() => setDismissed(true)}
            className="text-xs text-slate-400 hover:text-slate-600 px-2">
            Más tarde
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Versión de Microsoft Store: la Store instala las actualizaciones, pero avisamos igual que en la
 * de GitHub cuando ya hay una versión nueva en la Store (src-tauri/src/store.rs) y llevamos a su ficha.
 */
export function StoreUpdateNotice() {
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    tauriImport('@tauri-apps/api/core')
      .then(({ invoke }) => invoke('store_update_available'))
      .then((found) => { if (!cancelled && found) setAvailable(true) })
      .catch(() => {}) // sin identidad de paquete o sin conexión: no se avisa
    return () => { cancelled = true }
  }, [])

  if (!available || dismissed) return null

  async function openStore() {
    try {
      const { invoke } = await tauriImport('@tauri-apps/api/core')
      await invoke('open_store_page')
    } catch {
      // Si no se puede abrir, el aviso sigue ahí
      return
    }
    setDismissed(true)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-indigo-200 rounded-2xl shadow-lg p-4 max-w-sm">
      <p className="text-sm font-semibold text-slate-800 mb-1">Nueva versión disponible</p>
      <p className="text-xs text-slate-500 mb-3">
        Hay una versión nueva de Zenit en Microsoft Store. Se instalará sola, o puedes actualizar ahora desde la Store.
      </p>
      <div className="flex gap-2">
        <button onClick={openStore}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
          Abrir Microsoft Store
        </button>
        <button onClick={() => setDismissed(true)}
          className="text-xs text-slate-400 hover:text-slate-600 px-2">
          Más tarde
        </button>
      </div>
    </div>
  )
}

/**
 * Android: aviso cuando Google Play tiene una versión nueva (platform/playUpdate.js). «Actualizar»
 * abre la pantalla de actualización de Play, que la instala y vuelve a abrir Zenit.
 */
export function PlayUpdateNotice() {
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    checkPlayUpdate().then((r) => { if (!cancelled && r.available) setAvailable(true) })
    return () => { cancelled = true }
  }, [])

  if (!available || dismissed) return null

  return (
    <div className="fixed left-2 right-2 z-50 bg-white border border-indigo-200 rounded-2xl shadow-lg p-4"
      style={{ bottom: 'calc(4.75rem + var(--sab))' }}>
      <p className="text-sm font-semibold text-slate-800 mb-1">Nueva versión disponible</p>
      <p className="text-xs text-slate-500 mb-3">Hay una versión nueva de Zenit en Google Play.</p>
      <div className="flex gap-2">
        <button onClick={() => { setDismissed(true); startPlayUpdate() }}
          className="flex-1 bg-indigo-600 active:bg-indigo-700 text-white text-sm px-3 py-2.5 rounded-xl">
          Actualizar
        </button>
        <button onClick={() => setDismissed(true)} className="text-sm text-slate-500 px-3">
          Más tarde
        </button>
      </div>
    </div>
  )
}
