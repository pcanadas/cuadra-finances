import { Link } from 'react-router-dom'
import { openQuickAdd } from '../platform/quickAdd'

// Inicio sin datos (móvil): primeros pasos
export default function Welcome() {
  return (
    <div className="flex flex-col items-center text-center px-2 pt-6 pb-4">
      <div className="text-5xl mb-3">👋</div>
      <h1 className="text-xl font-bold text-slate-800">Te damos la bienvenida a Cuadra</h1>
      <p className="text-sm text-slate-500 mt-2 max-w-xs">
        Empieza apuntando un gasto o importando los movimientos de tu banco.
      </p>

      <div className="w-full max-w-sm mt-7 space-y-3">
        <button onClick={openQuickAdd}
          className="w-full flex items-center gap-4 text-left bg-indigo-600 active:bg-indigo-700 text-white rounded-2xl px-5 py-4 shadow-sm">
          <span className="text-3xl leading-none">＋</span>
          <span>
            <span className="block font-semibold">Apunta tu primer gasto</span>
            <span className="block text-sm text-indigo-100">En segundos, con el botón + de abajo</span>
          </span>
        </button>
        <Link to="/importar"
          className="w-full flex items-center gap-4 text-left bg-white border border-slate-200 active:bg-slate-50 rounded-2xl px-5 py-4 shadow-sm">
          <span className="text-3xl leading-none">📥</span>
          <span>
            <span className="block font-semibold text-slate-800">Importa un extracto del banco</span>
            <span className="block text-sm text-slate-500">PDF, CSV o Excel descargado de tu banco</span>
          </span>
        </Link>
      </div>

      <p className="text-xs text-slate-400 mt-8 max-w-xs">
        🔒 Tus datos se guardan solo en este móvil. Haz copias de seguridad de vez en cuando desde Más → Exportar datos.
      </p>
    </div>
  )
}
