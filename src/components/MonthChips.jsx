import { monthKeyLabel } from '../utils/period'

const formatEur = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)

const STATUS_STYLE = {
  'conseguido':      { icon: '✓', className: 'bg-emerald-100 text-emerald-700' },
  'parcial':         { icon: '◐', className: 'bg-amber-100 text-amber-700' },
  'no conseguido':   { icon: '✗', className: 'bg-rose-100 text-rose-700' },
  'en curso':        { icon: '…', className: 'bg-slate-100 text-slate-500' },
  'meta conseguida': { icon: '🎉', className: 'bg-emerald-100 text-emerald-700' },
}

/** Historial de un plan de ahorro o meta: ✓ conseguido, ◐ parcial, ✗ no conseguido. */
export default function MonthChips({ months, max = 12 }) {
  return (
    <div className="flex flex-wrap gap-1">
      {months.slice(-max).map((m) => {
        const st = STATUS_STYLE[m.status]
        const detail = m.contributed == null ? `cuota ${formatEur(m.quota)}` : `${formatEur(m.contributed)} de ${formatEur(m.quota)}`
        return (
          <span key={m.key} title={`${monthKeyLabel(m.key)}: ${m.status} (${detail})`}
            className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium ${st.className}`}>
            {monthKeyLabel(m.key).slice(0, 3)} {st.icon}
          </span>
        )
      })}
    </div>
  )
}
