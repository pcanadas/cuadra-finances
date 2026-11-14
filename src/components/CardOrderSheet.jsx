import { useBackHandler } from '../platform/back'
import { DASHBOARD_CARDS } from '../utils/dashboardOrder'

/** Hoja para cambiar el orden de las tarjetas del Dashboard con ↑ / ↓. */
export default function CardOrderSheet({ order, onChange, onReset, onClose }) {
  useBackHandler(true, onClose)
  const labelOf = Object.fromEntries(DASHBOARD_CARDS.map((c) => [c.id, c.label]))
  const move = (i, d) => {
    const next = [...order]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }
  const arrow = 'w-10 h-10 lg:w-8 lg:h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none'
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'var(--sab)' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-2">
          <p className="text-base font-semibold text-slate-700">Ordenar tarjetas</p>
          <p className="text-xs text-slate-500 mt-0.5">El resumen se queda arriba. Las tarjetas sin datos no se muestran.</p>
        </div>
        <ul className="overflow-y-auto px-3 pb-2">
          {order.map((id, i) => (
            <li key={id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-b-0">
              <span className="flex-1 min-w-0 text-sm text-slate-700">{labelOf[id]}</span>
              <button className={arrow} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
              <button className={arrow} onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label="Bajar">↓</button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100">
          <button onClick={onReset} className="text-sm text-slate-500 hover:text-slate-700">Restablecer</button>
          <button onClick={onClose} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Hecho</button>
        </div>
      </div>
    </div>
  )
}
