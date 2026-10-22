import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useBackHandler } from '../platform/back'
import useTransactionStore from '../store/useTransactionStore'
import QuickAdd from './QuickAdd.mobile'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/movimientos', label: 'Movimientos' },
  { to: '/cuentas', label: 'Cuentas' },
  { to: '/gastos-fijos', label: 'Gastos fijos' },
  { to: '/importar', label: 'Importar' },
  { to: '/categorias', label: 'Categorías' },
  { to: '/subcategorias', label: 'Subcategorías' },
  { to: '/acerca', label: 'Acerca de' },
]

// Móvil: barra inferior = Inicio · Movimientos · ➕ · Cuentas · Más
const MOBILE_LEFT = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/movimientos', label: 'Movimientos', icon: '📋' },
]
const MOBILE_RIGHT = [
  { to: '/cuentas', label: 'Cuentas', icon: '🏦' },
]
const MOBILE_MORE = [
  { to: '/importar', label: 'Importar extracto', icon: '📥' },
  { to: '/gastos-fijos', label: 'Gastos fijos', icon: '📆' },
  { to: '/categorias', label: 'Categorías', icon: '🏷️' },
  { to: '/subcategorias', label: 'Subcategorías', icon: '🗂️' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
  { to: '/acerca', label: 'Acerca de', icon: 'ℹ️' },
]

const SAVED_LABEL = { gasto: 'Gasto guardado', ingreso: 'Ingreso guardado', transferencia: 'Transferencia guardada' }

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
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [toast, setToast] = useState(null) // { text, ids }
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)
  const { pathname } = useLocation()
  const moreActive = MOBILE_MORE.some(l => l.to === pathname)
  useBackHandler(moreOpen, () => setMoreOpen(false))

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
              <span className="text-xl font-bold text-indigo-600">Cuadra</span>
              <span className="text-xs text-slate-400 font-medium">Finanzas del hogar</span>
            </div>
            <div className="flex items-center gap-1">
              {links.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
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

      {/* Móvil: solo el hueco de la barra de estado */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-50" style={{ height: 'var(--sat)' }} />

      {/* Hoja "Más" (móvil) */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute left-0 right-0 bg-white rounded-t-2xl shadow-lg p-2"
            style={{ bottom: 'calc(4rem + var(--sab))' }}
            onClick={e => e.stopPropagation()}
          >
            {MOBILE_MORE.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                  }`
                }
              >
                <span className="text-xl w-7 text-center">{icon}</span>
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Aviso tras guardar, con deshacer */}
      {toast && (
        <div className="lg:hidden fixed left-3 right-3 z-50 flex items-center gap-3 bg-slate-800 text-white rounded-xl px-4 py-3 shadow-lg"
          style={{ bottom: 'calc(4.75rem + var(--sab))' }}>
          <span className="flex-1 text-sm">{toast.text}</span>
          <button onClick={undo} className="text-sm font-semibold text-indigo-300">Deshacer</button>
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
              onClick={() => { setMoreOpen(false); setQuickAddOpen(true) }}
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

      {quickAddOpen && (
        <QuickAdd
          onClose={() => setQuickAddOpen(false)}
          onSaved={({ tipo, ids }) => { setQuickAddOpen(false); setToast({ text: SAVED_LABEL[tipo], ids }) }}
        />
      )}
    </>
  )
}
