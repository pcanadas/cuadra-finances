import { useState, useMemo, useRef } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useSubcategoryStore from '../store/useSubcategoryStore'
import useBudgetStore from '../store/useBudgetStore'
import useRecurringStore from '../store/useRecurringStore'
import SelectSheet from '../components/SelectSheet'
import { isTransferTx } from '../utils/transferPairing'
import { expandSplits } from '../utils/splits'
import { fixedStatusForMonth, isDueInMonth } from '../insights/fixedItems'

const formatEur = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
const PERIOD_FACTOR = { mensual: 1, bimestral: 0.5, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12 }
const PERIOD_LABELS = { mensual: 'Mensual', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const SUGGESTIONS_SHOWN = 8
const MONTH_LONG = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

/** Returns the list of month indices (0-11) when the item is due */
function getDueMonths(item) {
  return Array.from({ length: 12 }, (_, i) => i).filter((m) => isDueInMonth(item, m))
}

export default function GastosFijos() {
  const transactions = useTransactionStore((s) => s.transactions)
  const categories   = useCategoryStore((s) => s.categories)
  const subcategories = useSubcategoryStore((s) => s.subcategories)
  const budgets      = useBudgetStore((s) => s.budgets)
  const setBudget    = useBudgetStore((s) => s.setBudget)
  const { items: recurringItems, addItem: addRecurring, updateItem: updateRecurring, deleteItem: deleteRecurring } = useRecurringStore()

  const ingresoCatIds  = useMemo(() => new Set(categories.filter((c) => c.esIngreso).map((c) => c.id)), [categories])
  const transferCatIds = useMemo(() => new Set(categories.filter((c) => c.esTransferencia).map((c) => c.id)), [categories])
  const sortedCats     = useMemo(() => categories.filter((c) => !c.esTransferencia).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [categories])

  // ── form state ──
  const [showForm, setShowForm] = useState(false)
  const formRef = useRef(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ nombre: '', importe: '', categoriaId: '', subcategoriaId: '', periodicidad: 'mensual', fechaFin: '', mesReferencia: '' })

  // ── budget edit state ──
  const [editBudgetCat, setEditBudgetCat] = useState(null)
  const [editBudgetVal, setEditBudgetVal] = useState('')

  // ── dismissed suggestions ──
  const [showAllSuggestions, setShowAllSuggestions] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('cuadra-dismissed-recurring') || '[]')) }
    catch { return new Set() }
  })

  const dismissSuggestion = (key) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(key)
      localStorage.setItem('cuadra-dismissed-recurring', JSON.stringify([...next]))
      return next
    })
  }

  // ── computed ──
  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = new Date().getMonth()
  const currentYear  = new Date().getFullYear()

  const activeItems = useMemo(
    () => recurringItems.filter((r) => r.activo && (!r.fechaFin || r.fechaFin >= today)),
    [recurringItems, today],
  )

  const expenseItems = useMemo(() => activeItems.filter((r) => !ingresoCatIds.has(r.categoriaId)), [activeItems, ingresoCatIds])
  const incomeItems  = useMemo(() => activeItems.filter((r) => ingresoCatIds.has(r.categoriaId)), [activeItems, ingresoCatIds])

  const totalFixedExpenses = useMemo(
    () => expenseItems.reduce((s, r) => s + r.importe * (PERIOD_FACTOR[r.periodicidad] || 1), 0),
    [expenseItems],
  )
  const totalFixedIncome = useMemo(
    () => incomeItems.reduce((s, r) => s + r.importe * (PERIOD_FACTOR[r.periodicidad] || 1), 0),
    [incomeItems],
  )

  // Month status: which fixed expenses already paid? (los traspasos entre cuentas no son pagos ni cobros;
  // los movimientos desglosados cuentan por partidas)
  const monthTx = useMemo(
    () => expandSplits(transactions).filter((t) => {
      const d = new Date(t.fechaContable)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && !isTransferTx(t, transferCatIds)
    }),
    [transactions, currentMonth, currentYear, transferCatIds],
  )

  // Only items due this month
  const dueThisMonth = useMemo(() => activeItems.filter((r) => isDueInMonth(r, currentMonth)), [activeItems, currentMonth])

  const fixedStatus = useMemo(() => fixedStatusForMonth(dueThisMonth, monthTx, ingresoCatIds), [dueThisMonth, monthTx, ingresoCatIds])

  // Suggestions: expenses in 3+ months, not already added, not dismissed
  const suggestions = useMemo(() => {
    const normalize = (desc) =>
      (desc || '').toUpperCase().replace(/\d{2}\/\d{2}\/\d{2,4}/g, '').replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 30)
    const existingNames = new Set(recurringItems.map((r) => normalize(r.nombre)))
    const yearTx = transactions.filter((t) => {
      const y = new Date(t.fechaContable).getFullYear()
      return y === currentYear && !isTransferTx(t, transferCatIds)
    })
    const groups = {}
    yearTx.forEach((t) => {
      const key = normalize(t.descripcion)
      if (key.length < 4) return
      if (!groups[key]) groups[key] = { desc: t.descripcion, months: new Set(), total: 0, count: 0, catId: t.categoria, subcatId: t.subcategoria, isIncome: t.importe > 0 }
      groups[key].months.add(new Date(t.fechaContable).getMonth())
      groups[key].total += Math.abs(t.importe)
      groups[key].count += 1
    })
    return Object.entries(groups)
      .filter(([, g]) => g.months.size >= 3)
      .map(([key, g]) => ({ key, nombre: g.desc, media: g.total / g.count, catId: g.catId, subcatId: g.subcatId, isIncome: g.isIncome }))
      .filter((s) => !existingNames.has(normalize(s.nombre)) && !dismissed.has(s.key))
      .sort((a, b) => b.media - a.media)
  }, [transactions, recurringItems, dismissed, transferCatIds, currentYear])

  // Budget progress (current month)
  const budgetProgress = useMemo(() => {
    if (budgets.length === 0) return []
    const expenseTx = monthTx.filter((t) => t.importe < 0)
    return budgets.map((b) => {
      const cat = categories.find((c) => c.id === b.categoriaId)
      if (!cat) return null
      const spent = expenseTx.filter((t) => t.categoria === b.categoriaId).reduce((s, t) => s + Math.abs(t.importe), 0)
      const fixedInCat = expenseItems.filter((r) => r.categoriaId === b.categoriaId).reduce((s, r) => s + r.importe * (PERIOD_FACTOR[r.periodicidad] || 1), 0)
      const pct = b.limite > 0 ? Math.min((spent / b.limite) * 100, 100) : 0
      return { ...b, cat, spent, fixedInCat, pct, over: spent > b.limite }
    }).filter(Boolean).sort((a, b) => b.pct - a.pct)
  }, [budgets, monthTx, categories, expenseItems])

  // ── helpers ──
  function openForm(item) {
    if (item) {
      setEditingId(item.id)
      setForm({ nombre: item.nombre, importe: String(item.importe), categoriaId: item.categoriaId || '', subcategoriaId: item.subcategoriaId || '', periodicidad: item.periodicidad, fechaFin: item.fechaFin || '', mesReferencia: item.mesReferencia != null ? String(item.mesReferencia) : '' })
    } else {
      setEditingId(null)
      setForm({ nombre: '', importe: '', categoriaId: '', subcategoriaId: '', periodicidad: 'mensual', fechaFin: '', mesReferencia: '' })
    }
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  async function handleDelete() {
    if (!editingId || !window.confirm(`¿Eliminar «${form.nombre}»?`)) return
    await deleteRecurring(editingId)
    setShowForm(false)
    setEditingId(null)
  }

  async function handleSave() {
    const data = {
      nombre: form.nombre.trim(),
      importe: parseFloat(form.importe) || 0,
      categoriaId: form.categoriaId || null,
      subcategoriaId: form.subcategoriaId || null,
      periodicidad: form.periodicidad,
      fechaFin: form.fechaFin || null,
      mesReferencia: form.periodicidad !== 'mensual' && form.mesReferencia !== '' ? parseInt(form.mesReferencia) : null,
    }
    if (!data.nombre || data.importe <= 0) return
    if (editingId) await updateRecurring(editingId, data)
    else await addRecurring(data)
    setShowForm(false)
    setEditingId(null)
  }

  // ── render ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Gastos fijos</h1>
          <p className="hidden lg:block text-slate-400 text-sm mt-0.5">Planifica tus gastos e ingresos recurrentes</p>
        </div>
        <button onClick={() => openForm(null)} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
          + Añadir
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
        <div className="min-w-0 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 lg:p-4">
          <p className="text-[11px] text-emerald-600 uppercase font-semibold leading-tight">Ingresos fijos / mes</p>
          <p className="text-base lg:text-lg font-bold tabular-nums break-words text-emerald-600">{formatEur(totalFixedIncome)}</p>
          <p className="text-[11px] text-emerald-500/60">{incomeItems.length} concepto{incomeItems.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="min-w-0 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 lg:p-4">
          <p className="text-[11px] text-rose-500 uppercase font-semibold">Gastos fijos / mes</p>
          <p className="text-base lg:text-lg font-bold tabular-nums break-words text-rose-500">{formatEur(totalFixedExpenses)}</p>
          <p className="text-[11px] text-rose-500/60">{expenseItems.length} concepto{expenseItems.length !== 1 ? 's' : ''}</p>
        </div>
        <div className={`min-w-0 border rounded-xl p-3 lg:p-4 ${totalFixedIncome - totalFixedExpenses >= 0 ? 'bg-violet-500/10 border-violet-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
          <p className={`text-[11px] uppercase font-semibold ${totalFixedIncome - totalFixedExpenses >= 0 ? 'text-violet-600' : 'text-amber-600'}`}>Disponible tras fijos</p>
          <p className={`text-base lg:text-lg font-bold tabular-nums break-words ${totalFixedIncome - totalFixedExpenses >= 0 ? 'text-violet-600' : 'text-amber-600'}`}>{formatEur(totalFixedIncome - totalFixedExpenses)}</p>
          <p className="text-[11px] text-slate-400">Ingresos − gastos fijos</p>
        </div>
        <div className="min-w-0 bg-slate-500/10 border border-slate-500/20 rounded-xl p-3 lg:p-4">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Gastos fijos anuales</p>
          <p className="text-base lg:text-lg font-bold tabular-nums break-words text-slate-600">{formatEur(totalFixedExpenses * 12)}</p>
          <p className="text-[11px] text-slate-400">Proyección anual</p>
        </div>
      </div>

      {/* ── Form (inline) ── */}
      {showForm && (
        <div ref={formRef} className="scroll-mt-20 bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">{editingId ? 'Editar' : 'Nuevo gasto/ingreso fijo'}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-indigo-300" autoFocus />
            <input type="number" min="0" step="1" placeholder="Importe" value={form.importe} onChange={(e) => setForm((f) => ({ ...f, importe: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <SelectSheet title="Categoría" value={form.categoriaId}
              onChange={(v) => setForm((f) => ({ ...f, categoriaId: v, subcategoriaId: '' }))}
              options={[{ value: '', label: 'Categoría…' }, ...sortedCats.map((c) => ({ value: c.id, label: c.nombre + (c.esIngreso ? ' (ingreso)' : ''), color: c.color }))]} />
            {form.categoriaId && subcategories.filter((s) => s.categoriaId === form.categoriaId).length > 0 && (
              <SelectSheet title="Subcategoría" value={form.subcategoriaId}
                onChange={(v) => setForm((f) => ({ ...f, subcategoriaId: v }))}
                options={[{ value: '', label: 'Subcategoría…' }, ...subcategories.filter((s) => s.categoriaId === form.categoriaId).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((s) => ({ value: s.id, label: s.nombre }))]} />
            )}
            <SelectSheet title="Periodicidad" value={form.periodicidad}
              onChange={(v) => setForm((f) => ({ ...f, periodicidad: v, mesReferencia: v === 'mensual' ? '' : f.mesReferencia }))}
              options={Object.entries(PERIOD_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
            {form.periodicidad !== 'mensual' && (
              <SelectSheet title="Mes de cobro" value={String(form.mesReferencia)}
                onChange={(v) => setForm((f) => ({ ...f, mesReferencia: v }))}
                options={[{ value: '', label: 'Mes de cobro…' }, ...MONTH_SHORT.map((m, i) => ({ value: String(i), label: m }))]} />
            )}
            <div className="flex items-center gap-1 min-w-0">
              <label className="text-xs text-slate-400 whitespace-nowrap">Fin:</label>
              <input type="date" value={form.fechaFin} onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                className="min-w-0 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!form.nombre.trim() || !form.importe}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50">{editingId ? 'Guardar' : 'Añadir'}</button>
            <button onClick={() => { setShowForm(false); setEditingId(null) }}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-600">Cancelar</button>
            {editingId && (
              <button onClick={handleDelete} className="lg:hidden ml-auto px-3 py-1.5 text-sm text-red-500">Eliminar</button>
            )}
          </div>
        </div>
      )}

      {/* ── Status this month ── */}
      {fixedStatus.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:p-5">
          <div className="flex items-baseline justify-between gap-2 mb-4">
            <p className="text-sm font-semibold text-slate-700">Estado de {MONTH_LONG[currentMonth]}</p>
            <p className="text-xs text-slate-400">
              {fixedStatus.filter((r) => r.paid).length} de {fixedStatus.length} al día
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-5">
            {[true, false].map((isIncome) => {
              const list = fixedStatus.filter((r) => r.isIncome === isIncome)
              if (!list.length) return null
              return (
                <StatusGroup key={String(isIncome)} isIncome={isIncome} items={list}
                  categories={categories} subcategories={subcategories}
                  onEdit={openForm} onDelete={(r) => deleteRecurring(r.id)} />
              )
            })}
          </div>
        </div>
      )}

      {/* ── Budgets by category ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:p-5">
        <p className="text-sm font-semibold text-slate-700 mb-1">Presupuestos por categoría</p>
        <p className="text-xs text-slate-400 mb-3">Límites de gasto mensual — los gastos fijos de cada categoría se muestran como referencia</p>

        {budgetProgress.length > 0 && (
          <div className="space-y-3 mb-4">
            {budgetProgress.map((b) => (
              <div key={b.categoriaId}>
                {/* Nombre arriba y los importes debajo: con letra grande no caben en una línea */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.cat.color }} />
                      <span className="text-sm font-medium text-slate-700 truncate">{b.cat.nombre}</span>
                    </div>
                    <p className="text-xs mt-0.5 pl-[1.125rem]">
                      <span className={`font-semibold tabular-nums ${b.over ? 'text-red-500' : 'text-slate-700'}`}>{formatEur(b.spent)}</span>
                      <span className="text-slate-500"> de {formatEur(b.limite)}</span>
                      {b.over && <span className="text-red-500"> · superado en {formatEur(b.spent - b.limite)}</span>}
                      {b.fixedInCat > 0 && <span className="text-slate-400"> · {formatEur(b.fixedInCat)} fijos</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 lg:gap-2 shrink-0">
                    <button onClick={() => { setEditBudgetCat(b.categoriaId); setEditBudgetVal(String(b.limite)) }}
                      className="text-xs lg:text-[10px] px-1 py-1 lg:p-0 text-slate-400 hover:text-slate-600">editar</button>
                    <button onClick={() => setBudget(b.categoriaId, 0)}
                      className="text-xs lg:text-[10px] px-1 py-1 lg:p-0 text-red-400 hover:text-red-600">quitar</button>
                  </div>
                </div>
                <div className="mt-1.5 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${b.over ? 'bg-red-400' : b.pct > 75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${b.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit budget inline */}
        {editBudgetCat ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">Límite para {categories.find((c) => c.id === editBudgetCat)?.nombre}:</span>
            <input type="number" min="0" step="10" value={editBudgetVal} onChange={(e) => setEditBudgetVal(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs w-24 focus:outline-none focus:ring-2 focus:ring-amber-300" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { setBudget(editBudgetCat, parseFloat(editBudgetVal) || 0); setEditBudgetCat(null) } }} />
            <button onClick={() => { setBudget(editBudgetCat, parseFloat(editBudgetVal) || 0); setEditBudgetCat(null) }}
              className="text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg">Guardar</button>
            <button onClick={() => setEditBudgetCat(null)} className="text-xs px-2 py-1 text-slate-400 hover:text-slate-600">Cancelar</button>
          </div>
        ) : (
          <SelectSheet title="Añadir presupuesto" value="" className="text-xs"
            onChange={(v) => {
              if (v) {
                setEditBudgetCat(v)
                const existing = budgets.find((b) => b.categoriaId === v)
                setEditBudgetVal(existing ? String(existing.limite) : '')
              }
            }}
            options={[{ value: '', label: '+ Añadir presupuesto…' }, ...sortedCats.filter((c) => !c.esIngreso).map((c) => ({ value: c.id, label: c.nombre, color: c.color }))]} />
        )}
      </div>

      {/* ── Suggestions ── */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:p-5">
          <p className="text-sm font-semibold text-slate-700 mb-1">Sugerencias detectadas</p>
          <p className="text-xs text-slate-400 mb-3">Gastos e ingresos que aparecen en 3 o más meses — pulsa para añadir o ✕ para descartar</p>
          <div className="flex flex-wrap gap-2">
            {(showAllSuggestions ? suggestions : suggestions.slice(0, SUGGESTIONS_SHOWN)).map((s) => (
              <div key={s.key} className={`max-w-full flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border ${s.isIncome ? 'border-green-300 bg-green-100' : 'border-cyan-200 bg-cyan-50'}`}>
                <button
                  onClick={() => { openForm(null); setForm({ nombre: s.nombre, importe: String(Math.round(s.media * 100) / 100), categoriaId: s.catId || '', subcategoriaId: s.subcatId || '', periodicidad: 'mensual', fechaFin: '', mesReferencia: '' }) }}
                  className={`truncate max-w-[14rem] lg:max-w-[160px] ${s.isIncome ? 'text-green-800 hover:text-green-950' : 'text-cyan-700 hover:text-cyan-900'}`}
                >
                  + {s.nombre} <span className={s.isIncome ? 'text-green-700' : 'text-cyan-600'}>~{formatEur(s.media)}</span>
                </button>
                <button onClick={() => dismissSuggestion(s.key)} className={`ml-0.5 hover:text-red-500 ${s.isIncome ? 'text-green-400' : 'text-cyan-300'}`} title="Descartar sugerencia">✕</button>
              </div>
            ))}
          </div>
          {suggestions.length > SUGGESTIONS_SHOWN && (
            <button onClick={() => setShowAllSuggestions((v) => !v)} className="mt-3 text-xs font-medium text-indigo-500 hover:text-indigo-700 py-1">
              {showAllSuggestions ? 'Ver menos' : `Ver más (${suggestions.length - SUGGESTIONS_SHOWN})`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Estado del mes: un grupo (ingresos o gastos) y sus filas ──
const STATUS_ORDER = (r) => (r.paid ? 2 : r.partial ? 1 : 0) // primero lo pendiente

/** Etiqueta y colores de cada estado. */
function statusOf(r) {
  if (r.paid) return { label: r.isIncome ? 'Cobrado' : 'Pagado', pill: 'bg-emerald-500/15 text-emerald-600', bar: 'bg-emerald-500' }
  if (r.partial) return { label: 'En parte', pill: 'bg-amber-500/15 text-amber-600', bar: 'bg-amber-500' }
  return { label: 'Pendiente', pill: 'bg-slate-500/10 text-slate-500', bar: 'bg-slate-300' }
}

function ProgressBar({ value, total, className }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (value / total) * 100)) : 0
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function StatusGroup({ isIncome, items, categories, subcategories, onEdit, onDelete }) {
  const expected = items.reduce((s, r) => s + r.importe, 0)
  const done = items.reduce((s, r) => s + (r.paidAmount ?? 0), 0)
  const pending = items.filter((r) => !r.paid).length
  const sorted = [...items].sort((a, b) => STATUS_ORDER(a) - STATUS_ORDER(b))
  const color = isIncome ? 'text-emerald-600' : 'text-rose-500'
  return (
    <div>
      <div className="rounded-xl bg-slate-50 p-3 mb-2">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <p className={`text-[11px] uppercase font-semibold ${color}`}>{isIncome ? 'Ingresos fijos' : 'Gastos fijos'}</p>
          <p className="text-[11px] text-slate-500">
            {pending ? `${pending} pendiente${pending !== 1 ? 's' : ''}` : '✓ Todo al día'}
          </p>
        </div>
        <p className="text-sm text-slate-600 mb-1.5">
          {isIncome ? 'Cobrado' : 'Pagado'} <span className={`font-bold ${color}`}>{formatEur(done)}</span>
          <span className="text-slate-400"> de {formatEur(expected)}</span>
        </p>
        <ProgressBar value={done} total={expected} className={isIncome ? 'bg-emerald-500' : 'bg-rose-400'} />
      </div>
      <div>
        {sorted.map((r) => (
          <ItemRow key={r.id} r={r} categories={categories} subcategories={subcategories} onEdit={() => onEdit(r)} onDelete={() => onDelete(r)} />
        ))}
      </div>
    </div>
  )
}

function ItemRow({ r, categories, subcategories, onEdit, onDelete }) {
  const st = statusOf(r)
  const cat = categories.find((c) => c.id === r.categoriaId)
  const subcat = subcategories?.find((s) => s.id === r.subcategoriaId)
  const months = r.periodicidad !== 'mensual' ? getDueMonths(r).map((m) => MONTH_SHORT[m]).join(', ') : null
  const paid = r.paidAmount ?? 0
  const over = Math.round((paid - r.importe) * 100) / 100
  // Pensado para el móvil con letra grande: nombre y estado a la izquierda (se recortan o bajan de
  // línea), lo pagado y lo previsto a la derecha en dos líneas, la barra a lo ancho
  return (
    <div className="group py-2.5 px-1 border-b border-slate-100 last:border-b-0">
      <div className="flex items-start gap-3">
        <button onClick={onEdit} className="flex-1 min-w-0 text-left">
          <span className="flex items-center gap-2 min-w-0">
            {cat && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />}
            <span className="min-w-0 text-sm text-slate-800 truncate">{r.nombre}</span>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-slate-400">
            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full whitespace-nowrap ${st.pill}`}>{st.label}</span>
            {subcat && <span>{subcat.nombre}</span>}
            <span>{PERIOD_LABELS[r.periodicidad] || r.periodicidad}{months && ` · ${months}`}</span>
            {r.fechaFin && <span className="text-amber-500">hasta {r.fechaFin}</span>}
          </span>
        </button>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums text-slate-700">{r.paid || r.partial ? formatEur(paid) : '—'}</p>
          <p className="text-[11px] tabular-nums text-slate-400">de {formatEur(r.importe)}</p>
        </div>
      </div>
      <div className="mt-1.5"><ProgressBar value={paid} total={r.importe} className={st.bar} /></div>
      <div className="flex items-center justify-between gap-2 mt-1 min-h-[1rem]">
        {r.paid && Math.abs(over) >= 0.01 ? (
          <p className={`text-[11px] ${(over > 0) === r.isIncome ? 'text-emerald-600' : 'text-amber-600'}`}>
            {formatEur(Math.abs(over))} {over > 0 ? 'más' : 'menos'} de lo previsto
          </p>
        ) : !r.paid ? (
          <p className="text-[11px] text-slate-400">Falta {formatEur(r.importe - paid)}</p>
        ) : <span />}
        <div className="hidden lg:flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="text-[10px] text-slate-400 hover:text-slate-600">editar</button>
          <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-600">quitar</button>
        </div>
      </div>
    </div>
  )
}
