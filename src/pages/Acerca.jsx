import { useState } from 'react'
import { tauriImport } from '../utils/tauriImport'
import { version as APP_VERSION } from '../../package.json'
const IS_TAURI = '__TAURI_INTERNALS__' in window

export default function Acerca() {
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState(null) // null | 'uptodate' | 'available' | 'error' | 'notauri'
  const [updateInfo, setUpdateInfo] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [installing, setInstalling] = useState(false)

  async function checkUpdates() {
    if (!IS_TAURI) {
      setResult('notauri')
      return
    }
    setChecking(true)
    setResult(null)
    setUpdateInfo(null)
    setErrorMsg(null)
    try {
      const { check } = await tauriImport('@tauri-apps/plugin-updater')
      const upd = await check()
      if (upd?.available) {
        setUpdateInfo(upd)
        setResult('available')
      } else {
        setResult('uptodate')
      }
    } catch (e) {
      setErrorMsg(String(e?.message ?? e))
      setResult('error')
    } finally {
      setChecking(false)
    }
  }

  async function handleInstall() {
    setInstalling(true)
    try {
      await updateInfo.downloadAndInstall()
      const { relaunch } = await tauriImport('@tauri-apps/plugin-process')
      await relaunch()
    } catch {
      setResult('error')
      setInstalling(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto py-16 px-4 flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-indigo-600 mb-1">Cuadra</h1>
        <p className="text-slate-500 text-sm">Finanzas del hogar</p>
        <p className="mt-3 text-xs text-slate-400 font-mono">v{APP_VERSION}</p>
      </div>

      <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Versión instalada</span>
          <span className="text-sm font-semibold text-slate-800 font-mono">{APP_VERSION}</span>
        </div>

        <div className="border-t border-slate-100" />

        <div className="flex flex-col gap-2">
          <button
            onClick={checkUpdates}
            disabled={checking || installing}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            {checking ? 'Comprobando…' : 'Comprobar actualizaciones'}
          </button>

          {result === 'uptodate' && (
            <p className="text-center text-sm text-green-600">Tienes la última versión instalada.</p>
          )}
          {result === 'notauri' && (
            <p className="text-center text-sm text-slate-400">Las actualizaciones automáticas solo están disponibles en la app de escritorio.</p>
          )}
          {result === 'error' && (
            <div className="text-center">
              <p className="text-sm text-red-500">No se pudo comprobar actualizaciones.</p>
              {errorMsg && <p className="text-xs text-red-400 mt-1 font-mono break-all">{errorMsg}</p>}
            </div>
          )}
          {result === 'available' && updateInfo && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-col gap-2">
              <p className="text-sm font-semibold text-indigo-800">
                Nueva versión disponible — {updateInfo.version}
              </p>
              {updateInfo.body && (
                <p className="text-xs text-indigo-600">{updateInfo.body}</p>
              )}
              <button
                onClick={handleInstall}
                disabled={installing}
                className="mt-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {installing ? 'Instalando…' : 'Instalar y reiniciar'}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 text-center">
        MIT License · <a href="https://github.com/pcanadas/cuadra-finances" className="underline hover:text-slate-600" target="_blank" rel="noreferrer">github.com/pcanadas/cuadra-finances</a>
      </p>
    </div>
  )
}
