import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useBackHandler } from '../platform/back'

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

// Móvil: estas van en la barra inferior; el resto, en "Más"
const MOBILE_MAIN = [
  { to: '/', label: 'Inicio', icon: '🏠' },
  { to: '/movimientos', label: 'Movimientos', icon: '📋' },
  { to: '/importar', label: 'Importar', icon: '📥' },
  { to: '/cuentas', label: 'Cuentas', icon: '🏦' },
]
const MOBILE_MORE = links.filter(l => !MOBILE_MAIN.some(m => m.to === l.to))

export default function Navbar() {
  const { dark, setDark } = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = MOBILE_MORE.some(l => l.to === pathname)
  useBackHandler(moreOpen, () => setMoreOpen(false))

  const themeButton = (
    <button
      onClick={() => setDark(!dark)}
      className="ml-2 p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
      title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  )

  return (
    <>
      <nav
        className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 lg:h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-indigo-600">Cuadra</span>
              <span className="text-xs text-slate-400 font-medium">Finanzas del hogar</span>
            </div>
            <div className="hidden lg:flex items-center gap-1">
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
              {themeButton}
            </div>
            <div className="lg:hidden">{themeButton}</div>
          </div>
        </div>
      </nav>

      {/* Hoja "Más" (móvil) */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMoreOpen(false)}>
          <div
            className="absolute left-0 right-0 bg-white rounded-t-2xl shadow-lg p-2"
            style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            {MOBILE_MORE.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-3 rounded-lg text-base font-medium ${
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Barra inferior (móvil) */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-16">
          {MOBILE_MAIN.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                  isActive ? 'text-indigo-700' : 'text-slate-500'
                }`
              }
            >
              <span className="text-xl leading-none">{icon}</span>
              {label}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium ${
              moreActive || moreOpen ? 'text-indigo-700' : 'text-slate-500'
            }`}
          >
            <span className="text-xl leading-none">☰</span>
            Más
          </button>
        </div>
      </nav>
    </>
  )
}
