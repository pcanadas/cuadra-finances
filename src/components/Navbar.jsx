import { NavLink } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/movimientos', label: 'Movimientos' },
  { to: '/cuentas', label: 'Cuentas' },
  { to: '/importar', label: 'Importar' },
  { to: '/categorias', label: 'Categorías' },
  { to: '/subcategorias', label: 'Subcategorías' },
  { to: '/acerca', label: 'Acerca de' },
]

export default function Navbar() {
  const { dark, setDark } = useTheme()

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
  )
}
