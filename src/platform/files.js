import { tauriImport } from '../utils/tauriImport'
import { isTauri } from './index'

/**
 * Guarda un archivo pidiendo al usuario dónde.
 * - Tauri (escritorio y Android): diálogo nativo + plugin-fs. En Android la ruta
 *   devuelta es un URI content:// del selector del sistema.
 * - Navegador: descarga.
 *
 * @param {object} opts
 * @param {string} opts.filename   nombre sugerido
 * @param {string|Uint8Array} opts.data  texto o binario
 * @param {{name: string, extensions: string[]}} opts.filter
 * @param {string} [opts.mime]     tipo MIME para la descarga del navegador
 * @returns {Promise<string|null>} ruta/URI guardada, 'download' en navegador, o null si se cancela
 */
export async function saveFile({ filename, data, filter, mime = 'application/octet-stream' }) {
  if (isTauri) {
    const { save } = await tauriImport('@tauri-apps/plugin-dialog')
    const { writeTextFile, writeFile } = await tauriImport('@tauri-apps/plugin-fs')
    const path = await save({ defaultPath: filename, filters: [filter] })
    if (!path) return null
    if (typeof data === 'string') await writeTextFile(path, data)
    else await writeFile(path, data)
    return path
  }

  const blob = new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'download'
}

/** Texto legible para avisar de dónde se guardó (los URI content:// no dicen nada al usuario). */
export function describeSavedPath(path) {
  if (!path || path === 'download') return null
  return path.startsWith('content://') ? null : path
}
