import { useState } from 'react'
import { useBackHandler } from '../platform/back'
import { MONTHS, capitalize as cap, periodLabel } from '../utils/period'

// ─── Hoja de selección ──────────────────────────────────────────────────────

function PeriodSheet({ value, years, onChange, onClose }) {
  useBackHandler(true, onClose)
  const [mode, setMode] = useState(value.month == null ? 'año' : 'mes')
  const [year, setYear] = useState(value.year)
  const minYear = Math.min(...years, year)
  const maxYear = Math.max(...years, year)

  const pick = (p) => { onChange(p); onClose() }
  const stepBtn = 'w-10 h-10 rounded-full text-xl text-slate-600 hover:bg-slate-100 active:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 space-y-4"
        style={{ paddingBottom: 'calc(1rem + var(--sab))' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          {['mes', 'año'].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`py-2 rounded-lg text-sm font-semibold ${mode === m ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {m === 'mes' ? 'Mes' : 'Año'}
            </button>
          ))}
        </div>

        {mode === 'mes' ? (
          <>
            <div className="flex items-center justify-between">
              <button className={stepBtn} disabled={year <= minYear} onClick={() => setYear(year - 1)} aria-label="Año anterior">‹</button>
              <span className="text-base font-bold text-slate-800">{year}</span>
              <button className={stepBtn} disabled={year >= maxYear} onClick={() => setYear(year + 1)} aria-label="Año siguiente">›</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MONTHS.map((m, i) => {
                const active = value.month === i && value.year === year
                return (
                  <button key={m} onClick={() => pick({ year, month: i })}
                    className={`py-3 rounded-xl text-sm font-medium ${active ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-100'}`}>
                    {cap(m.slice(0, 3))}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[...years].sort((a, b) => b - a).map((y) => {
              const active = value.month == null && value.year === y
              return (
                <button key={y} onClick={() => pick({ year: y, month: null })}
                  className={`py-3 rounded-xl text-sm font-semibold ${active ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-100'}`}>
                  {y}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Selector: ‹ [Octubre 2026 ▾] › ─────────────────────────────────────────

export default function PeriodPicker({ value, years, onChange }) {
  const [open, setOpen] = useState(false)

  function step(dir) {
    if (value.month == null) return onChange({ year: value.year + dir, month: null })
    const idx = value.year * 12 + value.month + dir
    onChange({ year: Math.floor(idx / 12), month: idx % 12 })
  }

  const arrow = 'w-9 h-9 rounded-full text-xl text-slate-500 bg-white shadow-sm hover:bg-slate-50 hover:text-slate-700 active:bg-slate-100'

  return (
    <div className="flex items-center gap-2">
      <button className={arrow} onClick={() => step(-1)} aria-label="Periodo anterior">‹</button>
      <button onClick={() => setOpen(true)}
        className="min-w-[11.5rem] px-4 h-9 rounded-full bg-white shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100">
        {periodLabel(value)} <span className="text-slate-400">▾</span>
      </button>
      <button className={arrow} onClick={() => step(1)} aria-label="Periodo siguiente">›</button>
      {open && <PeriodSheet value={value} years={years} onChange={onChange} onClose={() => setOpen(false)} />}
    </div>
  )
}
