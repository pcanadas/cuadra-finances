import { useEffect, useState } from 'react'
import { useBackHandler } from '../platform/back'
import { isTauri } from '../platform'
import { composeEmail } from '../platform/share'

// Ventana "Comentarios": el texto se envía con la app de correo del usuario
export default function FeedbackSheet({ onClose, onSent }) {
  useBackHandler(true, onClose)
  const [text, setText] = useState('')
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (!isTauri) return
    import('@tauri-apps/api/app').then(({ getVersion }) => getVersion()).then(setVersion).catch(() => {})
  }, [])

  function send() {
    const body = `${text.trim()}\n\n—\nCuadra ${version || ''} · ${navigator.userAgent.match(/Android [\d.]+/)?.[0] ?? 'escritorio'}`
    composeEmail({ subject: 'Comentarios sobre Cuadra', body })
    onSent?.()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center"
      style={{ paddingBottom: 'var(--sab)' }} onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-3xl mb-1">💬</div>
          <h2 className="text-base font-semibold text-slate-800">¡Danos algunas sugerencias para mejorar nuestra aplicación!</h2>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} autoFocus
          placeholder="¿Qué te gustaría mejorar o qué echas en falta?"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <p className="text-xs text-slate-400 -mt-2">Se abrirá tu app de correo con el mensaje preparado.</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose}
            className="py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 active:bg-slate-50">
            No, gracias
          </button>
          <button onClick={send} disabled={!text.trim()}
            className="py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:bg-indigo-700 disabled:opacity-40">
            Enviar
          </button>
        </div>
      </div>
    </div>
  )
}
