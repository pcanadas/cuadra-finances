import { useRef } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useBackHandler } from '../platform/back'
import { getCategoryIcon } from '../utils/categoryIcons'
import SelectSheet from './SelectSheet'

function formatEur(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

function dayLabel(iso) {
  try {
    const s = format(new Date(iso), "EEEE d 'de' MMMM yyyy", { locale: es })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch {
    return iso
  }
}

// Agrupa movimientos consecutivos con la misma fecha (respeta el orden actual)
function groupByDay(transactions) {
  const groups = []
  for (const t of transactions) {
    const last = groups[groups.length - 1]
    if (last && last.fecha === t.fechaContable) last.items.push(t)
    else groups.push({ fecha: t.fechaContable, items: [t] })
  }
  return groups
}

const LONG_PRESS_MS = 450

// Pulsación larga → onLongPress; toque normal → onTap. Se cancela si el dedo se mueve (scroll).
function useLongPress(onLongPress, onTap) {
  const timer = useRef(null)
  const fired = useRef(false)
  const start = useRef(null)

  const clear = () => { clearTimeout(timer.current); timer.current = null }

  return {
    onPointerDown(e) {
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = setTimeout(() => {
        fired.current = true
        navigator.vibrate?.(15)
        onLongPress()
      }, LONG_PRESS_MS)
    },
    onPointerMove(e) {
      if (!start.current) return
      if (Math.abs(e.clientX - start.current.x) > 10 || Math.abs(e.clientY - start.current.y) > 10) clear()
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
    onClick() {
      if (fired.current) { fired.current = false; return }
      onTap()
    },
  }
}

function TransactionCard({ t, cat, sub, acc, showAccount, selected, selectionMode, onOpen, onToggleSelect }) {
  const press = useLongPress(
    () => onToggleSelect(t.id),
    () => (selectionMode ? onToggleSelect(t.id) : onOpen(t)),
  )

  return (
    <li>
      <button
        {...press}
        className={`w-full flex items-center gap-3 px-4 py-3 min-h-14 text-left select-none ${
          selected ? 'bg-indigo-50' : 'active:bg-slate-50'
        }`}
      >
        {selectionMode ? (
          <span className={`w-9 h-9 rounded-full border-2 shrink-0 flex items-center justify-center text-base text-white ${
            selected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
          }`}>
            {selected && '✓'}
          </span>
        ) : (
          <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-lg"
            style={{ backgroundColor: (cat?.color || '#cbd5e1') + '26' }}>
            {cat ? getCategoryIcon(cat) : '❔'}
          </span>
        )}
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-slate-800 truncate">{t.descripcion || '—'}</span>
          <span className="block text-xs text-slate-400 truncate">
            {cat ? cat.nombre : 'Sin categoría'}
            {sub && ` · ${sub.nombre}`}
            {showAccount && acc && ` · ${acc.nombre}`}
            {t.esManual && ' · manual'}
          </span>
        </span>
        <span className={`text-sm font-semibold whitespace-nowrap ${t.importe >= 0 ? 'text-green-600' : 'text-slate-800'}`}>
          {formatEur(t.importe)}
        </span>
      </button>
    </li>
  )
}

// ─── Lista de tarjetas agrupadas por día ─────────────────────────────────────

export function TransactionCardList({ transactions, categories, subcategories, accounts, selected, onOpen, onToggleSelect }) {
  const selectionMode = selected.size > 0
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  const subMap = Object.fromEntries(subcategories.map((s) => [s.id, s]))
  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const showAccount = accounts.length > 1

  return (
    <div className="space-y-4">
      {groupByDay(transactions).map(({ fecha, items }) => {
        const total = items.reduce((sum, t) => sum + t.importe, 0)
        return (
          <section key={fecha + items[0].id}>
            <div className="flex items-baseline justify-between px-1 mb-1.5">
              <h3 className="text-xs font-semibold text-slate-500">{dayLabel(fecha)}</h3>
              <span className={`text-xs font-medium ${total >= 0 ? 'text-green-600' : 'text-slate-500'}`}>
                {formatEur(total)}
              </span>
            </div>
            <ul className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
              {items.map((t) => (
                <TransactionCard
                  key={t.id}
                  t={t}
                  cat={catMap[t.categoria]}
                  sub={subMap[t.subcategoria]}
                  acc={accMap[t.accountId]}
                  showAccount={showAccount}
                  selected={selected.has(t.id)}
                  selectionMode={selectionMode}
                  onOpen={onOpen}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// ─── Bottom sheet de detalle / edición ──────────────────────────────────────

export function TransactionSheet({ transaction: t, categories, subcategories, accounts, onChangeCategory, onChangeSubcategory, onEdit, onDelete, onClose }) {
  useBackHandler(true, onClose)

  const acc = accounts.find((a) => a.id === t.accountId)
  const subs = t.categoria ? subcategories.filter((s) => s.categoriaId === t.categoria) : []

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl shadow-xl p-5 space-y-4"
        style={{ paddingBottom: 'calc(1.25rem + var(--sab))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-10 h-1 rounded-full bg-slate-200" />

        <div>
          <p className={`text-2xl font-bold ${t.importe >= 0 ? 'text-green-600' : 'text-slate-800'}`}>
            {formatEur(t.importe)}
          </p>
          <p className="text-sm text-slate-700 mt-1 break-words">{t.descripcion || '—'}</p>
          <p className="text-xs text-slate-400 mt-1">
            {dayLabel(t.fechaContable)}
            {acc && ` · ${acc.nombre}`}
            {t.saldo != null && t.saldo !== 0 && ` · Saldo ${formatEur(t.saldo)}`}
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Categoría</label>
          <SelectSheet title="Categoría" className="w-full py-2.5 text-base rounded-xl"
            value={t.categoria || ''} onChange={(v) => onChangeCategory(t, v)}
            options={[{ value: '', label: 'Sin categoría' }, ...categories.map((c) => ({ value: c.id, label: c.nombre, color: c.color }))]} />
        </div>

        {t.categoria && (
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Subcategoría</label>
            <SelectSheet title="Subcategoría" className="w-full py-2.5 text-base rounded-xl"
              value={t.subcategoria || ''} onChange={(v) => onChangeSubcategory(t, v)}
              options={[{ value: '', label: '—' }, ...subs.map((s) => ({ value: s.id, label: s.nombre })), { value: '__new__', label: '＋ Nueva…' }]} />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          {t.esManual && (
            <>
              <button onClick={() => onEdit(t)}
                className="flex-1 py-3 text-sm font-medium rounded-xl border border-slate-200 text-slate-700 active:bg-slate-50">
                Editar
              </button>
              <button onClick={() => onDelete(t)}
                className="flex-1 py-3 text-sm font-medium rounded-xl border border-red-200 text-red-600 active:bg-red-50">
                Eliminar
              </button>
            </>
          )}
          <button onClick={onClose}
            className="flex-1 py-3 text-sm font-medium rounded-xl bg-indigo-600 text-white active:bg-indigo-700">
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
