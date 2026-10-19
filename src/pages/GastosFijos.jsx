import { useState, useMemo } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useSubcategoryStore from '../store/useSubcategoryStore'
import useBudgetStore from '../store/useBudgetStore'
import useRecurringStore from '../store/useRecurringStore'

const formatEur = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
const PERIOD_FACTOR = { mensual: 1, bimestral: 0.5, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12 }
const PERIOD_LABELS = { mensual: 'Mensual', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }
const PERIOD_MONTHS = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }
const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

/** Returns true if the item is due in the given month (0-11) */
function isDueInMonth(item, month) {
  if (item.periodicidad === 'mensual') return true
  const ref = item.mesReferencia ?? 0 // 0-11
  const interval = PERIOD_MONTHS[item.periodicidad] || 1
  // Check if (month - ref) is a multiple of interval (mod 12)
  const diff = ((month - ref) % 12 + 12) % 12
  return diff % interval === 0
}

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
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ nombre: '', importe: '', categoriaId: '', subcategoriaId: '', periodicidad: 'mensual', fechaFin: '', mesReferencia: '' })

  // ── budget edit state ──
  const [editBudgetCat, setEditBudgetCat] = useState(null)
  const [editBudgetVal, setEditBudgetVal] = useState('')

  // ── dismissed suggestions ──
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

  // Month status: which fixed expenses already paid?
  const monthTx = useMemo(
    () => transactions.filter((t) => {
      const d = new Date(t.fechaContable)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    }),
    [transactions, currentMonth, currentYear],
  )

  // Only items due this month
  const dueThisMonth = useMemo(() => activeItems.filter((r) => isDueInMonth(r, currentMonth)), [activeItems, currentMonth])

  const fixedStatus = useMemo(() => {
    return dueThisMonth.map((r) => {
      const isIncome = ingresoCatIds.has(r.categoriaId)
      const pool = isIncome ? monthTx.filter((t) => t.importe > 0) : monthTx.filter((t) => t.importe < 0)
      const tolerant = (t) => Math.abs(Math.abs(t.importe) - r.importe) < r.importe * 0.3
      // Priority: subcategory > category > name words
      const match = r.subcategoriaId
        ? pool.find((t) => t.subcategoria === r.subcategoriaId && tolerant(t))
        : r.categoriaId
          ? pool.find((t) => t.categoria === r.categoriaId && tolerant(t))
          : (() => {
              const words = r.nombre.toUpperCase().split(/\s+/).filter((w) => w.length >= 4)
              return words.length > 0 ? pool.find((t) => { const d = (t.descripcion || '').toUpperCase(); return words.every((w) => d.includes(w)) && tolerant(t) }) : null
            })()
      return { ...r, paid: !!match, paidAmount: match ? Math.abs(match.importe) : null, isIncome }
    })
  }, [dueThisMonth, monthTx, ingresoCatIds])

  // Suggestions: expenses in 3+ months, not already added, not dismissed
  const suggestions = useMemo(() => {
    const normalize = (desc) =>
      (desc || '').toUpperCase().replace(/\d{2}\/\d{2}\/\d{2,4}/g, '').replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 30)
    const existingNames = new Set(recurringItems.map((r) => normalize(r.nombre)))
    const yearTx = transactions.filter((t) => {
      const y = new Date(t.fechaContable).getFullYear()
      return y === currentYear && !transferCatIds.has(t.categoria)
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
      .slice(0, 12)
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
          <h1 className="text-2xl font-bold text-slate-800">Gastos fijos</h1>
          <p className="text-slate-400 text-sm mt-0.5">Planifica tus gastos e ingresos recurrentes</p>
        </div>
        <button onClick={() => openForm(null)} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
          + Añadir
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <p className="text-[11px] text-emerald-600 uppercase font-semibold">Ingresos fijos / mes</p>
          <p className="text-lg font-bold text-emerald-600">{formatEur(totalFixedIncome)}</p>
          <p className="text-[11px] text-emerald-500/60">{incomeItems.length} concepto{incomeItems.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
          <p className="text-[11px] text-rose-500 uppercase font-semibold">Gastos fijos / mes</p>
          <p className="text-lg font-bold text-rose-500">{formatEur(totalFixedExpenses)}</p>
          <p className="text-[11px] text-rose-500/60">{expenseItems.length} concepto{expenseItems.length !== 1 ? 's' : ''}</p>
        </div>
        <div className={`border rounded-xl p-4 ${totalFixedIncome - totalFixedExpenses >= 0 ? 'bg-violet-500/10 border-violet-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
          <p className={`text-[11px] uppercase font-semibold ${totalFixedIncome - totalFixedExpenses >= 0 ? 'text-violet-600' : 'text-amber-600'}`}>Disponible tras fijos</p>
          <p className={`text-lg font-bold ${totalFixedIncome - totalFixedExpenses >= 0 ? 'text-violet-600' : 'text-amber-600'}`}>{formatEur(totalFixedIncome - totalFixedExpenses)}</p>
          <p className="text-[11px] text-slate-400">Ingresos − gastos fijos</p>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-4">
          <p className="text-[11px] text-slate-500 uppercase font-semibold">Gastos fijos anuales</p>
          <p className="text-lg font-bold text-slate-600">{formatEur(totalFixedExpenses * 12)}</p>
          <p className="text-[11px] text-slate-400">Proyección anual</p>
        </div>
      </div>

      {/* ── Form (inline) ── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">{editingId ? 'Editar' : 'Nuevo gasto/ingreso fijo'}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-indigo-300" autoFocus />
            <input type="number" min="0" step="1" placeholder="Importe" value={form.importe} onChange={(e) => setForm((f) => ({ ...f, importe: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            <select value={form.categoriaId} onChange={(e) => setForm((f) => ({ ...f, categoriaId: e.target.value, subcategoriaId: '' }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="">Categoría…</option>
              {sortedCats.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.esIngreso ? ' (ingreso)' : ''}</option>)}
            </select>
            {form.categoriaId && subcategories.filter((s) => s.categoriaId === form.categoriaId).length > 0 && (
              <select value={form.subcategoriaId} onChange={(e) => setForm((f) => ({ ...f, subcategoriaId: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">Subcategoría…</option>
                {subcategories.filter((s) => s.categoriaId === form.categoriaId).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            )}
            <select value={form.periodicidad} onChange={(e) => setForm((f) => ({ ...f, periodicidad: e.target.value, mesReferencia: e.target.value === 'mensual' ? '' : f.mesReferencia }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
              {Object.entries(PERIOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {form.periodicidad !== 'mensual' && (
              <select value={form.mesReferencia} onChange={(e) => setForm((f) => ({ ...f, mesReferencia: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">Mes de cobro…</option>
                {MONTH_SHORT.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            )}
            <div className="flex items-center gap-1">
              <label className="text-xs text-slate-400 whitespace-nowrap">Fin:</label>
              <input type="date" value={form.fechaFin} onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!form.nombre.trim() || !form.importe}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50">{editingId ? 'Guardar' : 'Añadir'}</button>
            <button onClick={() => { setShowForm(false); setEditingId(null) }}
              className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-600">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Status this month ── */}
      {fixedStatus.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-700 mb-1">Estado del mes actual</p>
          <p className="text-xs text-slate-400 mb-3">
            {fixedStatus.filter((r) => r.paid).length} de {fixedStatus.length} cobrados/pagados
          </p>

          {/* Income items */}
          {fixedStatus.filter((r) => r.isIncome).length > 0 && (
            <>
              <p className="text-[11px] text-emerald-500 uppercase font-semibold mb-1">Ingresos fijos</p>
              <div className="space-y-1 mb-3">
                {fixedStatus.filter((r) => r.isIncome).map((r) => (
                  <ItemRow key={r.id} r={r} categories={categories} subcategories={subcategories} onEdit={() => openForm(r)} onDelete={() => deleteRecurring(r.id)} />
                ))}
              </div>
            </>
          )}

          {/* Expense items */}
          {fixedStatus.filter((r) => !r.isIncome).length > 0 && (
            <>
              <p className="text-[11px] text-rose-500 uppercase font-semibold mb-1">Gastos fijos</p>
              <div className="space-y-1">
                {fixedStatus.filter((r) => !r.isIncome).map((r) => (
                  <ItemRow key={r.id} r={r} categories={categories} subcategories={subcategories} onEdit={() => openForm(r)} onDelete={() => deleteRecurring(r.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Budgets by category ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-700 mb-1">Presupuestos por categoría</p>
        <p className="text-xs text-slate-400 mb-3">Límites de gasto mensual — los gastos fijos de cada categoría se muestran como referencia</p>

        {budgetProgress.length > 0 && (
          <div className="space-y-3 mb-4">
            {budgetProgress.map((b) => (
              <div key={b.categoriaId}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.cat.color }} />
                    <span className="text-xs font-medium text-slate-700">{b.cat.nombre}</span>
                    {b.fixedInCat > 0 && (
                      <span className="text-[10px] text-slate-400">({formatEur(b.fixedInCat)} fijos)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${b.over ? 'text-red-500' : 'text-slate-600'}`}>
                      {formatEur(b.spent)} / {formatEur(b.limite)}
                    </span>
                    <button onClick={() => { setEditBudgetCat(b.categoriaId); setEditBudgetVal(String(b.limite)) }}
                      className="text-[10px] text-slate-400 hover:text-slate-600">editar</button>
                    <button onClick={() => setBudget(b.categoriaId, 0)}
                      className="text-[10px] text-red-400 hover:text-red-600">quitar</button>
                  </div>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
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
          <select className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-300"
            value="" onChange={(e) => {
              if (e.target.value) {
                setEditBudgetCat(e.target.value)
                const existing = budgets.find((b) => b.categoriaId === e.target.value)
                setEditBudgetVal(existing ? String(existing.limite) : '')
              }
            }}>
            <option value="">+ Añadir presupuesto…</option>
            {sortedCats.filter((c) => !c.esIngreso).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
      </div>

      {/* ── Suggestions ── */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-700 mb-1">Sugerencias detectadas</p>
          <p className="text-xs text-slate-400 mb-3">Gastos e ingresos que aparecen en 3 o más meses — pulsa para añadir o ✕ para descartar</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <div key={s.key} className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border ${s.isIncome ? 'border-green-300 bg-green-100' : 'border-cyan-200 bg-cyan-50'}`}>
                <button
                  onClick={() => { openForm(null); setForm({ nombre: s.nombre, importe: String(Math.round(s.media * 100) / 100), categoriaId: s.catId || '', subcategoriaId: s.subcatId || '', periodicidad: 'mensual', fechaFin: '', mesReferencia: '' }) }}
                  className={`truncate max-w-[160px] ${s.isIncome ? 'text-green-800 hover:text-green-950' : 'text-cyan-700 hover:text-cyan-900'}`}
                >
                  + {s.nombre} <span className={s.isIncome ? 'text-green-600' : 'text-cyan-400'}>~{formatEur(s.media)}</span>
                </button>
                <button onClick={() => dismissSuggestion(s.key)} className={`ml-0.5 hover:text-red-500 ${s.isIncome ? 'text-green-400' : 'text-cyan-300'}`} title="Descartar sugerencia">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Item row component ──
function ItemRow({ r, categories, subcategories, onEdit, onDelete }) {
  const cat = categories.find((c) => c.id === r.categoriaId)
  const subcat = subcategories?.find((s) => s.id === r.subcategoriaId)
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-sm ${r.paid ? 'text-emerald-500' : 'text-slate-300'}`}>{r.paid ? '✓' : '○'}</span>
        <span className="text-sm text-slate-700 truncate">{r.nombre}</span>
        {cat && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />}
        {subcat && <span className="text-[10px] text-slate-500">{subcat.nombre}</span>}
        <span className="text-[10px] text-slate-400">{PERIOD_LABELS[r.periodicidad] || r.periodicidad}</span>
        {r.periodicidad !== 'mensual' && (
          <span className="text-[10px] text-indigo-400" title="Meses de cobro">
            {getDueMonths(r).map((m) => MONTH_SHORT[m]).join(', ')}
          </span>
        )}
        {r.fechaFin && <span className="text-[10px] text-amber-500">hasta {r.fechaFin}</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {r.paid && r.paidAmount != null && <span className="text-[11px] text-emerald-500">{formatEur(r.paidAmount)}</span>}
        <span className={`text-xs font-semibold ${r.paid ? 'text-slate-400 line-through' : 'text-slate-600'}`}>{formatEur(r.importe)}</span>
        <button onClick={onEdit} className="text-[10px] text-slate-400 hover:text-slate-600">editar</button>
        <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-600">quitar</button>
      </div>
    </div>
  )
}
