import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import useCategoryStore from '../store/useCategoryStore'
import { useBackHandler } from '../platform/back'
import { getCategoryIcon, ICON_GROUPS } from '../utils/categoryIcons'
import { TEXT_SIZES, getTextSize, setTextSize } from '../platform/textSize'

// ─── Selector de icono (hoja inferior) ──────────────────────────────────────

function IconPicker({ category, onPick, onClose }) {
  useBackHandler(true, onClose)

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 max-h-[80vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(1rem + var(--sab))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="w-10 h-10 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: category.color + '26' }}>
            {getCategoryIcon(category)}
          </span>
          <h2 className="text-base font-semibold text-slate-800">{category.nombre}</h2>
        </div>
        {ICON_GROUPS.map((g) => (
          <div key={g.nombre} className="mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{g.nombre}</p>
            <div className="grid grid-cols-8 gap-1">
              {g.iconos.map((icon) => (
                <button key={icon} onClick={() => onPick(icon)}
                  className={`aspect-square rounded-lg text-2xl flex items-center justify-center ${
                    getCategoryIcon(category) === icon ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'active:bg-slate-100'
                  }`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function Ajustes() {
  const { dark, setDark } = useTheme()
  const categories = useCategoryStore((s) => s.categories)
  const updateCategory = useCategoryStore((s) => s.updateCategory)
  const [editingId, setEditingId] = useState(null)
  const [textSize, setTextSizeState] = useState(getTextSize)

  const sorted = [...categories].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const editing = categories.find((c) => c.id === editingId)

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Ajustes</h1>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Apariencia</h2>
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          {[{ v: false, label: '☀️ Claro' }, { v: true, label: '🌙 Oscuro' }].map(({ v, label }) => (
            <button key={label} onClick={() => setDark(v)}
              className={`py-2.5 rounded-lg text-sm font-semibold ${dark === v ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Tamaño de letra</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TEXT_SIZES.map((t) => (
            <button key={t.id} onClick={() => { setTextSize(t.id); setTextSizeState(t.id) }}
              className={`py-2.5 rounded-xl border text-sm ${textSize === t.id ? 'bg-indigo-600 border-indigo-600 text-white font-semibold' : 'bg-white border-slate-200 text-slate-600'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-slate-700">Iconos de categorías</h2>
        <p className="text-xs text-slate-400 mt-0.5 mb-3">Se muestran al añadir movimientos. Toca una categoría para cambiar su icono.</p>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {sorted.map((c) => (
            <button key={c.id} onClick={() => setEditingId(c.id)}
              className="flex flex-col items-center gap-1 py-2 rounded-xl active:bg-slate-50">
              <span className="w-11 h-11 rounded-full flex items-center justify-center text-2xl"
                style={{ backgroundColor: c.color + '26' }}>
                {getCategoryIcon(c)}
              </span>
              <span className="text-[11px] leading-tight text-slate-600 text-center line-clamp-2">{c.nombre}</span>
            </button>
          ))}
        </div>
      </section>

      {editing && (
        <IconPicker
          category={editing}
          onPick={async (icono) => { await updateCategory(editing.id, { icono }); setEditingId(null) }}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
