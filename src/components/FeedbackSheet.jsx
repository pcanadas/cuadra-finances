import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useBackHandler } from '../platform/back'
import { isTauri, isStore } from '../platform'
import { composeEmail, sendFeedback } from '../platform/share'

// Ventana "Comentarios": se envía al servidor de xyfos.com; si falla, se ofrece el correo
export default function FeedbackSheet({ onClose, onSent }) {
  useBackHandler(true, onClose)
  const [text, setText] = useState('')
  const [email, setEmail] = useState('')
  const [version, setVersion] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | offline | server | rate

  useEffect(() => {
    if (!isTauri) return
    import('@tauri-apps/api/app').then(({ getVersion }) => getVersion()).then(setVersion).catch(() => {})
  }, [])

  const platform = navigator.userAgent.match(/Android [\d.]+/)?.[0] ?? (isStore ? 'escritorio (Microsoft Store)' : 'escritorio')
  const emailValid = !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function send() {
    setStatus('sending')
    const result = await sendFeedback({ message: text.trim(), email: email.trim(), version, platform })
    if (result === 'ok') return onSent?.()
    setStatus(result)
  }

  function sendByEmail() {
    composeEmail({ subject: 'Comentarios sobre Zenit', body: `${text.trim()}\n\n—\nZenit ${version} · ${platform}` })
    onClose()
  }

  const input = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center"
      style={{ paddingBottom: 'var(--sab)' }} onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-3xl mb-1">💬</div>
          <h2 className="text-base font-semibold text-slate-800">¡Danos algunas sugerencias para mejorar nuestra aplicación!</h2>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} autoFocus maxLength={3000}
          placeholder="¿Qué te gustaría mejorar o qué echas en falta?"
          className={`${input} resize-none`} />
        <div>
          <input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="Tu email (opcional, si quieres respuesta)" className={input} />
          {!emailValid && <p className="text-xs text-red-600 mt-1">Revisa el email</p>}
        </div>
        <p className="text-xs text-slate-400">
          Solo usaremos estos datos para leer tu comentario y, si dejas tu email, responderte.{' '}
          <Link to="/privacidad" onClick={onClose} className="text-indigo-600">Más información</Link>
        </p>

        {(status === 'offline' || status === 'server') && (
          <div className="text-sm bg-red-50 text-red-700 rounded-xl px-3 py-2">
            {status === 'offline' ? 'No se ha podido enviar: revisa tu conexión.' : 'No se ha podido enviar ahora mismo.'}{' '}
            <button onClick={sendByEmail} className="font-semibold underline">Enviar por correo</button>
          </div>
        )}
        {status === 'rate' && (
          <p className="text-sm bg-amber-50 text-amber-700 rounded-xl px-3 py-2">Has enviado varios comentarios seguidos. Inténtalo dentro de un rato.</p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={onClose}
            className="py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 active:bg-slate-50">
            No, gracias
          </button>
          <button onClick={send} disabled={!text.trim() || !emailValid || status === 'sending'}
            className="py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold active:bg-indigo-700 disabled:opacity-40">
            {status === 'sending' ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
