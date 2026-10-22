import { useState } from 'react'
import { useBackHandler } from '../platform/back'
import { isMobile } from '../platform'

function Sheet({ title, value, options, onPick, onClose }) {
  useBackHandler(true, onClose)

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[75vh] flex flex-col"
        style={{ paddingBottom: 'var(--sab)' }}
        onClick={(e) => e.stopPropagation()}>
        {title && <p className="px-5 pt-4 pb-2 text-sm font-semibold text-slate-500">{title}</p>}
        <ul className="overflow-y-auto px-2 pb-2">
          {options.map((o) => {
            const active = o.value === value
            return (
              <li key={o.value}>
                <button onClick={() => onPick(o.value)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-base ${active ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700 active:bg-slate-50'}`}>
                  {o.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />}
                  <span className="flex-1 truncate">{o.label}</span>
                  {active && <span className="text-indigo-600">✓</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/**
 * Sustituto del <select> nativo: botón con el valor actual que abre una hoja
 * con las opciones ({ value, label, color? }).
 */
export default function SelectSheet({ value, options, onChange, title, className = '' }) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value) ?? options[0]

  if (!isMobile) {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className={`border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 max-w-full ${className}`}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white active:bg-slate-50 max-w-full ${className}`}>
        {current?.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: current.color }} />}
        <span className="flex-1 text-left truncate">{current?.label}</span>
        <span className="text-slate-400 text-xs">▾</span>
      </button>
      {open && (
        <Sheet title={title} value={value} options={options}
          onPick={(v) => { onChange(v); setOpen(false) }}
          onClose={() => setOpen(false)} />
      )}
    </>
  )
}
