import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useBackHandler } from '../platform/back'
import useTransactionStore from '../store/useTransactionStore'
import QuickAdd from './QuickAdd.mobile'
import { recommendApp } from '../platform/share'
import FeedbackSheet from './FeedbackSheet'
import { QUICK_ADD_EVENT, listenNativeQuickAdd } from '../platform/quickAdd'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/movimientos', label: 'Movimientos' },
  { to: '/cuentas', label: 'Cuentas' },
  { to: '/gastos-fijos', label: 'Gastos fijos' },
  { to: '/importar', label: 'Importar' },
  { to: '/categorias', label: 'Categorías' },
  { to: '/subcategorias', label: 'Subcategorías' },
]

// Móvil: barra inferior = Inicio · Registros · ➕ · Cuentas · Más
const MOBILE_LEFT = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/movimientos', label: 'Registros', icon: '📋' },
]
const MOBILE_RIGHT = [
  { to: '/cuentas', label: 'Cuentas', icon: '🏦' },
]
// "Más": gestión de la app · (línea) · información y contacto
const MOBILE_MORE = [
  { to: '/importar', label: 'Importar extracto', icon: '📥' },
  { to: '/exportar', label: 'Exportar datos', icon: '📤' },
  { to: '/gastos-fijos', label: 'Gastos fijos', icon: '📆' },
  { to: '/categorias', label: 'Categorías', icon: '🏷️' },
  { to: '/subcategorias', label: 'Subcategorías', icon: '🗂️' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
]
const MOBILE_INFO = [
  { to: '/ayuda', label: 'Ayuda', icon: '❓' },
  { to: '/terminos', label: 'Términos de uso', icon: '📄' },
  { to: '/privacidad', label: 'Política de privacidad', icon: '🔒' },
  { to: '/acerca', label: 'Sobre nosotros', icon: 'ℹ️' },
]

// Escritorio: menú «Más» con lo que no tiene pestaña propia
const DESKTOP_MORE = MOBILE_MORE.filter((l) => !links.some((d) => d.to === l.to))

const SAVED_LABEL = { gasto: 'Gasto guardado', ingreso: 'Ingreso guardado', transferencia: 'Transferencia guardada' }

const moreRowClass = 'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-base font-medium text-left'

function MoreLink({ to, label, icon, onClick }) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) => `${moreRowClass} ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'}`}>
      <span className="text-xl w-7 text-center">{icon}</span>
      {label}
    </NavLink>
  )
}

function MoreButton({ label, icon, onClick }) {
  return (
    <button onClick={onClick} className={`${moreRowClass} text-slate-700 active:bg-slate-50`}>
      <span className="text-xl w-7 text-center">{icon}</span>
      {label}
    </button>
  )
}

function DesktopMoreLink({ to, label, icon, onClick }) {
  return (
    <NavLink to={to} onClick={onClick}
      className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium ${
        isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100'
      }`}>
      <span className="w-5 text-center">{icon}</span>
      {label}
    </NavLink>
  )
}

function BottomLink({ to, label, icon, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[11px] leading-tight font-medium ${
          isActive ? 'text-indigo-700' : 'text-slate-500'
        }`
      }
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="max-w-full truncate px-0.5">{label}</span>
    </NavLink>
  )
}

export default function Navbar() {
  const { dark, setDark } = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState(null) // { tipo, key } mientras está abierta
  const [toast, setToast] = useState(null) // { text, ids }
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)
  const { pathname } = useLocation()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const moreActive = [...MOBILE_MORE, ...MOBILE_INFO].some(l => l.to === pathname)
  const desktopMoreActive = [...DESKTOP_MORE, ...MOBILE_INFO, { to: '/licencias' }].some(l => l.to === pathname)
  useBackHandler(moreOpen, () => setMoreOpen(false))
  useBackHandler(desktopMoreOpen, () => setDesktopMoreOpen(false))

  useEffect(() => {
    // key nueva: si ya estaba abierta (p. ej. «+ Ingreso» desde la notificación), empieza de cero con ese tipo
    const open = (e) => { setMoreOpen(false); setQuickAdd({ tipo: e.detail?.tipo || 'gasto', key: Date.now() }) }
    window.addEventListener(QUICK_ADD_EVENT, open)
    const stopNative = listenNativeQuickAdd()
    return () => { window.removeEventListener(QUICK_ADD_EVENT, open); stopNative() }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  async function undo() {
    const ids = toast?.ids ?? []
    setToast(null)
    for (const id of ids) await deleteTransaction(id)
  }

  return (
    <>
      {/* Escritorio: cabecera completa */}
      <nav className="hidden lg:block bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-indigo-600">Zenit</span>
              <span className="hidden xl:inline text-xs text-slate-400 font-medium">Finanzas personales</span>
            </div>
            <div className="flex items-center gap-1">
              {links.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `px-3 xl:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
              <div className="relative">
                <button
                  onClick={() => setDesktopMoreOpen((o) => !o)}
                  aria-expanded={desktopMoreOpen}
                  className={`px-3 xl:px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    desktopMoreActive || desktopMoreOpen
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  Más <span className="text-xs">▾</span>
                </button>
                {desktopMoreOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDesktopMoreOpen(false)} />
                    <div className="absolute right-0 mt-2 w-60 z-50 bg-white rounded-xl border border-slate-200 shadow-lg p-1.5">
                      {DESKTOP_MORE.map((l) => <DesktopMoreLink key={l.to} {...l} onClick={() => setDesktopMoreOpen(false)} />)}
                      <div className="my-1 border-t border-slate-200" />
                      {MOBILE_INFO.map((l) => <DesktopMoreLink key={l.to} {...l} onClick={() => setDesktopMoreOpen(false)} />)}
                      <button onClick={() => { setDesktopMoreOpen(false); setFeedbackOpen(true) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left text-slate-700 hover:bg-slate-100">
                        <span className="w-5 text-center">💬</span>
                        Comentarios
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setDark(!dark)}
                className="ml-2 p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {dark ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Móvil: cabecera compacta (los extremos quedan para búsqueda / menú) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200"
        style={{ paddingTop: 'var(--sat)' }}>
        <div className="h-12 flex items-center justify-between px-2">
          <div className="w-10" />
          <span className="text-lg font-bold text-indigo-600">Zenit</span>
          <div className="w-10" />
        </div>
      </header>

      {/* Hoja "Más" (móvil) */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute left-0 right-0 bg-white rounded-t-2xl shadow-lg p-2 overflow-y-auto overscroll-contain"
            // Entre la cabecera (3rem + barra de estado) y la barra inferior (4rem), con 0.75rem de aire
            style={{ bottom: 'calc(4rem + var(--sab))', maxHeight: 'calc(100dvh - 7.75rem - var(--sab) - var(--sat))' }}
            onClick={e => e.stopPropagation()}
          >
            {MOBILE_MORE.map((l) => <MoreLink key={l.to} {...l} onClick={() => setMoreOpen(false)} />)}
            <div className="my-1 border-t border-slate-200" />
            {MOBILE_INFO.map((l) => <MoreLink key={l.to} {...l} onClick={() => setMoreOpen(false)} />)}
            <MoreButton icon="💬" label="Comentarios" onClick={() => { setMoreOpen(false); setFeedbackOpen(true) }} />
            <MoreButton icon="💌" label="Recomendar a amigos" onClick={async () => {
              setMoreOpen(false)
              if ((await recommendApp()) === 'copied') setToast({ text: 'Enlace copiado al portapapeles', ids: [] })
            }} />
          </div>
        </div>
      )}

      {/* Aviso tras guardar, con deshacer (también en escritorio) */}
      {toast && (
        <div className="fixed left-3 right-3 bottom-[calc(4.75rem+var(--sab))] lg:left-auto lg:right-6 lg:bottom-6 lg:w-96 z-[80] flex items-center gap-3 bg-slate-800 text-white rounded-xl px-4 py-3 shadow-lg">
          <span className="flex-1 text-sm">{toast.text}</span>
          {toast.ids.length > 0 && <button onClick={undo} className="text-sm font-semibold text-indigo-300">Deshacer</button>}
        </div>
      )}

      {/* Barra inferior (móvil) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200"
        style={{ paddingBottom: 'var(--sab)' }}
      >
        <div className="flex h-16">
          {MOBILE_LEFT.map((l) => <BottomLink key={l.to} {...l} onClick={() => setMoreOpen(false)} />)}
          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={() => { setMoreOpen(false); setQuickAdd({ tipo: 'gasto', key: Date.now() }) }}
              className="w-14 h-14 -mt-6 rounded-full bg-indigo-600 active:bg-indigo-700 text-white text-3xl leading-none shadow-lg ring-4 ring-white"
              aria-label="Añadir movimiento"
            >
              +
            </button>
          </div>
          {MOBILE_RIGHT.map((l) => <BottomLink key={l.to} {...l} onClick={() => setMoreOpen(false)} />)}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 text-[11px] leading-tight font-medium ${
              moreActive || moreOpen ? 'text-indigo-700' : 'text-slate-500'
            }`}
          >
            <span className="text-xl leading-none">☰</span>
            Más
          </button>
        </div>
      </nav>

      {feedbackOpen && (
        <FeedbackSheet
          onClose={() => setFeedbackOpen(false)}
          onSent={() => { setFeedbackOpen(false); setToast({ text: '¡Gracias por tu comentario!', ids: [] }) }}
        />
      )}

      {quickAdd && (
        <QuickAdd
          key={quickAdd.key}
          initialTipo={quickAdd.tipo}
          onClose={() => setQuickAdd(null)}
          onSaved={({ tipo, ids }) => { setQuickAdd(null); setToast({ text: SAVED_LABEL[tipo], ids }) }}
        />
      )}
    </>
  )
}
