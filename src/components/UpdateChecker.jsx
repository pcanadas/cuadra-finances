import { useEffect, useState } from 'react'
import { tauriImport } from '../utils/tauriImport'

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
