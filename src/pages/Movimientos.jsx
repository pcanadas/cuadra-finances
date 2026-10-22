import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useAccountStore from '../store/useAccountStore'
import useSubcategoryStore from '../store/useSubcategoryStore'
import { extractKeyword } from '../utils/categorize'
import { handleTransferPairing, undoTransferPairing } from '../utils/transferPairing'
import * as XLSX from 'xlsx'
import { saveFile } from '../platform/files'
import { useBackHandler } from '../platform/back'
import { TransactionCardList, TransactionSheet } from '../components/TransactionList.mobile'

const PAGE_SIZE = 20

const ACCOUNT_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#3b82f6',
]

function formatEur(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

// ─── Modal: añadir transacción manual ────────────────────────────────────────

function ManualTransactionModal({ accounts, categories, defaultAccountId, initialData, onSave, onClose }) {
  const today = new Date().toISOString().slice(0, 10)
  const editing = !!initialData
  const [fecha,       setFecha]       = useState(initialData?.fechaContable ?? today)
  const [descripcion, setDescripcion] = useState(initialData?.descripcion ?? '')
  const [importe,     setImporte]     = useState(initialData?.importe != null ? String(initialData.importe) : '')
  const [categoria,   setCategoria]   = useState(initialData?.categoria ?? '')
  const [accountId,   setAccountId]   = useState(initialData?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? '')
  const [error,       setError]       = useState('')

  const sortedCategories = [...categories].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  useBackHandler(true, onClose)

  function handleSubmit(e) {
    e.preventDefault()
    const amount = parseFloat(String(importe).replace(',', '.'))
    if (!fecha)              return setError('La fecha es obligatoria')
    if (!descripcion.trim()) return setError('La descripción es obligatoria')
    if (isNaN(amount))       return setError('El importe no es válido')
    onSave({
      fechaContable: fecha,
      descripcion:   descripcion.trim(),
      importe:       amount,
      categoria:     categoria || null,
      accountId,
      categoriaManual: !!categoria,
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-slate-800 mb-4">
          {editing ? 'Editar movimiento manual' : 'Añadir movimiento manual'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Importe (negativo = gasto)</label>
              <input type="text" placeholder="-25.50" value={importe} onChange={(e) => setImporte(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Descripción</label>
            <input type="text" placeholder="Ej: Compra en mercadillo" value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Cuenta</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Categoría</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value="">Sin categoría</option>
                {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              {editing ? 'Guardar cambios' : 'Guardar'}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal: gestionar cuentas ─────────────────────────────────────────────────

function AccountsModal({ accounts, onAdd, onUpdate, onDelete, onClose }) {
  const [nombre, setNombre] = useState('')
  const [tipo,   setTipo]   = useState('banco')
  const [color,  setColor]  = useState(ACCOUNT_COLORS[0])
  useBackHandler(true, onClose)

  function handleAdd(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    onAdd({ nombre: nombre.trim(), tipo, color })
    setNombre('')
  }

  const TIPOS = { banco: 'Banco', efectivo: 'Efectivo', otro: 'Otro' }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-slate-800 mb-4">Gestionar cuentas</h2>
        <ul className="mb-4 space-y-2">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: a.color }} />
              <span className="flex-1 font-medium text-slate-700">{a.nombre}</span>
              <span className="text-xs text-slate-400">{TIPOS[a.tipo] ?? a.tipo}</span>
              {accounts.length > 1 && (
                <button onClick={() => onDelete(a.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-1">✕</button>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={handleAdd} className="space-y-2 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nueva cuenta</p>
          <input type="text" placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <div className="flex gap-2">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
              <option value="banco">Banco</option>
              <option value="efectivo">Efectivo</option>
              <option value="otro">Otro</option>
            </select>
            <div className="flex gap-1 items-center">
              {ACCOUNT_COLORS.slice(0, 6).map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${color === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <button type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            Añadir cuenta
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Movimientos() {
  const transactions        = useTransactionStore((s) => s.transactions)
  const updateTransaction   = useTransactionStore((s) => s.updateTransaction)
  const bulkUpdateTransactions = useTransactionStore((s) => s.bulkUpdateTransactions)
  const addManualTransaction    = useTransactionStore((s) => s.addManualTransaction)
  const deleteTransaction       = useTransactionStore((s) => s.deleteTransaction)
  const categories              = useCategoryStore((s) => s.categories)
  const { accounts, addAccount, deleteAccount } = useAccountStore()
  const subcategories = useSubcategoryStore((s) => s.subcategories)
  const addSubcategory = useSubcategoryStore((s) => s.addSubcategory)

  const [activeAccountId, setActiveAccountId] = useState('__all__')
  const [filterMonth,     setFilterMonth]     = useState('')
  const [filterCategory,  setFilterCategory]  = useState('')
  const [filterAccount,   setFilterAccount]   = useState('')
  const [filterText,      setFilterText]      = useState('')
  const [filterSubcategory, setFilterSubcategory] = useState('')
  const [filterType,      setFilterType]      = useState('')
  const [sortCol,         setSortCol]         = useState('fechaContable')
  const [sortDir,         setSortDir]         = useState('desc')
  const [page,            setPage]            = useState(1)
  const [selected,        setSelected]        = useState(new Set())
  const [bulkCategory,    setBulkCategory]    = useState('')
  const [bulkSubcategory, setBulkSubcategory] = useState('')
  const [showManual,      setShowManual]      = useState(false)
  const [editingTx,       setEditingTx]       = useState(null)
  const [showAccounts,    setShowAccounts]    = useState(false)
  const [showFilters,     setShowFilters]     = useState(false)
  const [openTxId,        setOpenTxId]        = useState(null)
  const [undoStack,       setUndoStack]       = useState([]) // [{id, prev}, ...]

  const MAX_UNDO = 30
  const transferCatIds = useMemo(() => new Set(categories.filter((c) => c.esTransferencia).map((c) => c.id)), [categories])
  const storeActions = { updateTransaction, addManualTransaction, deleteTransaction }

  async function trackAndUpdate(id, updates) {
    const tx = transactions.find((t) => t.id === id)
    if (!tx) return
    const prev = {}
    for (const key of Object.keys(updates)) prev[key] = tx[key] ?? null
    setUndoStack((s) => [...s.slice(-(MAX_UNDO - 1)), { id, prev }])
    await updateTransaction(id, updates)

    const updatedTx = { ...tx, ...updates }
    const wasTransfer = transferCatIds.has(tx.categoria)
    const isTransfer  = transferCatIds.has(updatedTx.categoria)
    if (!wasTransfer && isTransfer) {
      await handleTransferPairing(updatedTx, transactions, categories, subcategories, accounts, storeActions)
    } else if (wasTransfer && !isTransfer) {
      await undoTransferPairing(tx, transactions, storeActions)
    }
  }

  async function trackAndBulkUpdate(updatesMap) {
    const entries = []
    for (const [id, updates] of Object.entries(updatesMap)) {
      const tx = transactions.find((t) => t.id === id)
      if (!tx) continue
      const prev = {}
      for (const key of Object.keys(updates)) prev[key] = tx[key] ?? null
      entries.push({ id, prev })
    }
    setUndoStack((s) => [...s.slice(-(MAX_UNDO - entries.length)), ...entries])
    await bulkUpdateTransactions(updatesMap)

    // Handle transfer pairing for each updated transaction
    for (const [id, updates] of Object.entries(updatesMap)) {
      const tx = transactions.find((t) => t.id === id)
      if (!tx) continue
      const updatedTx = { ...tx, ...updates }
      const wasTransfer = transferCatIds.has(tx.categoria)
      const isTransfer  = transferCatIds.has(updatedTx.categoria)
      if (!wasTransfer && isTransfer) {
        await handleTransferPairing(updatedTx, transactions, categories, subcategories, accounts, storeActions)
      } else if (wasTransfer && !isTransfer) {
        await undoTransferPairing(tx, transactions, storeActions)
      }
    }
  }

  async function handleUndo() {
    if (undoStack.length === 0) return
    const last = undoStack[undoStack.length - 1]
    await updateTransaction(last.id, last.prev)
    setUndoStack((s) => s.slice(0, -1))
  }

  const monthOptions = useMemo(() => {
    const set = new Set()
    transactions.forEach((t) => {
      if (t.fechaContable) {
        const d = new Date(t.fechaContable)
        if (!isNaN(d)) set.add(format(d, 'yyyy-MM'))
      }
    })
    return [...set].sort().reverse()
  }, [transactions])

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [categories]
  )

  function toggleSort(col) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'fechaContable' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <span className="text-slate-300 ml-1">⇅</span>
    return <span className="text-indigo-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const defaultAccountId = accounts[0]?.id ?? null

  const filtered = useMemo(() => {
    let result = [...transactions]
    if (activeAccountId !== '__all__') {
      result = result.filter((t) => (t.accountId ?? defaultAccountId) === activeAccountId)
    }
    if (filterAccount) {
      result = result.filter((t) => (t.accountId ?? defaultAccountId) === filterAccount)
    }
    if (filterMonth) result = result.filter((t) => t.fechaContable?.startsWith(filterMonth))
    if (filterCategory) {
      result = result.filter((t) =>
        filterCategory === 'sin-categoria' ? !t.categoria : t.categoria === filterCategory
      )
    }
    if (filterSubcategory) {
      result = result.filter((t) =>
        filterSubcategory === 'sin-subcategoria' ? !t.subcategoria : t.subcategoria === filterSubcategory
      )
    }
    if (filterType === 'ingreso') result = result.filter((t) => t.importe >= 0)
    else if (filterType === 'gasto') result = result.filter((t) => t.importe < 0)
    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase()
      result = result.filter((t) => t.descripcion?.toLowerCase().includes(q))
    }
    result.sort((a, b) => {
      let av, bv
      if (sortCol === 'fechaContable') {
        av = new Date(a.fechaContable || 0).getTime()
        bv = new Date(b.fechaContable || 0).getTime()
      } else if (sortCol === 'descripcion') {
        av = (a.descripcion || '').toLowerCase()
        bv = (b.descripcion || '').toLowerCase()
        return sortDir === 'asc' ? av.localeCompare(bv, 'es') : bv.localeCompare(av, 'es')
      } else if (sortCol === 'importe') {
        av = a.importe ?? 0
        bv = b.importe ?? 0
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return result
  }, [transactions, activeAccountId, filterAccount, filterMonth, filterCategory, filterSubcategory, filterType, filterText, sortCol, sortDir])

  const totalPages    = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated     = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageIds       = useMemo(() => paginated.map((t) => t.id), [paginated])
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  function changeTab(id) {
    setActiveAccountId(id)
    setPage(1)
    setSelected(new Set())
    setBulkCategory('')
  }

  async function exportToExcel() {
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.nombre]))
    const subMap = Object.fromEntries(subcategories.map((s) => [s.id, s.nombre]))
    const accMap = Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))
    const rows = filtered.map((t) => ({
      Fecha: t.fechaContable,
      Descripción: t.descripcion,
      Importe: t.importe,
      Categoría: catMap[t.categoria] || '',
      Subcategoría: subMap[t.subcategoria] || '',
      Cuenta: accMap[t.accountId] || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    try {
      await saveFile({
        filename: `movimientos-${new Date().toISOString().slice(0, 10)}.xlsx`,
        data: new Uint8Array(data),
        filter: { name: 'Excel', extensions: ['xlsx'] },
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    } catch (e) {
      alert(`No se pudo exportar:
${e?.message ?? e}`)
    }
  }

  function toggleSelect(id) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelected((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.delete(id)); return n })
    } else {
      setSelected((prev) => { const n = new Set(prev); pageIds.forEach((id) => n.add(id)); return n })
    }
  }

  async function applyBulkCategory() {
    if ((!bulkCategory && !bulkSubcategory) || selected.size === 0) return
    const updatesMap = {}
    selected.forEach((id) => {
      const updates = {}
      if (bulkCategory) { updates.categoria = bulkCategory; updates.categoriaManual = true }
      if (bulkSubcategory) { updates.subcategoria = bulkSubcategory; updates.subcategoriaManual = true }
      updatesMap[id] = updates
    })
    await trackAndBulkUpdate(updatesMap)
    setSelected(new Set())
    setBulkCategory('')
    setBulkSubcategory('')
  }

  function changeCategory(t, value) {
    return trackAndUpdate(t.id, { categoria: value || null, categoriaManual: true, subcategoria: null })
  }

  async function changeSubcategory(t, value) {
    if (value === '__new__') {
      const nombre = window.prompt('Nombre de la nueva subcategoría:')
      if (!nombre?.trim()) return
      const kw = extractKeyword(t.descripcion)
      const cat = categories.find((c) => c.id === t.categoria)
      await addSubcategory({
        categoriaId: t.categoria,
        nombre: nombre.trim(),
        palabrasClave: kw ? [kw] : [],
        color: cat?.color || '#94a3b8',
      })
      const created = useSubcategoryStore.getState().subcategories.slice(-1)[0]
      if (created) await trackAndUpdate(t.id, { subcategoria: created.id, subcategoriaManual: true })
    } else {
      await trackAndUpdate(t.id, { subcategoria: value || null, subcategoriaManual: true })
    }
  }

  useBackHandler(selected.size > 0, () => { setSelected(new Set()); setBulkCategory(''); setBulkSubcategory('') })

  const activeFilterCount = [filterMonth, filterCategory, filterSubcategory, filterType].filter(Boolean).length
  const openTx = openTxId ? transactions.find((t) => t.id === openTxId) : null

  const formatDate = (iso) => {
    if (!iso) return '—'
    try { return format(new Date(iso), 'dd/MM/yyyy') } catch { return iso }
  }

  // Account badge colors
  const accountColorMap = useMemo(() => {
    const m = {}
    accounts.forEach((a) => { m[a.id] = a.color })
    return m
  }, [accounts])

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Movimientos</h1>
        <div className="flex gap-2 shrink-0">
          <button onClick={exportToExcel}
            className="px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            title={`Exportar ${filtered.length} movimientos filtrados a Excel`}>
            <span className="lg:hidden">Excel</span>
            <span className="hidden lg:inline">Exportar Excel</span>
          </button>
          <button onClick={() => setShowAccounts(true)}
            className="px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            Cuentas
          </button>
          {undoStack.length > 0 && (
            <button onClick={handleUndo}
              className="px-3 py-1.5 text-sm border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
              title="Deshacer último cambio">
              ↩<span className="hidden lg:inline"> Deshacer</span> ({undoStack.length})
            </button>
          )}
          <button onClick={() => setShowManual(true)}
            className="hidden lg:inline-block px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
            + Añadir manual
          </button>
        </div>
      </div>

      {/* Account tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => changeTab('__all__')}
          className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
            activeAccountId === '__all__'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Todas ({transactions.length})
        </button>
        {accounts.map((a) => {
          const count = transactions.filter((t) => (t.accountId ?? defaultAccountId) === a.id).length
          return (
            <button
              key={a.id}
              onClick={() => changeTab(a.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeAccountId === a.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
              {a.nombre}
              <span className="text-xs text-slate-400">({count})</span>
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div className="lg:hidden flex gap-2 mb-3">
        <input type="search" placeholder="Buscar..." value={filterText}
          onChange={(e) => { setFilterText(e.target.value); setPage(1) }}
          className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-base text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <button onClick={() => setShowFilters((v) => !v)}
          className={`px-3 py-2 text-sm rounded-lg border whitespace-nowrap ${
            showFilters || activeFilterCount ? 'border-indigo-300 text-indigo-700 bg-indigo-50' : 'border-slate-200 text-slate-600 bg-white'
          }`}>
          Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>
      </div>
      <div className={`${showFilters ? 'flex' : 'hidden'} lg:flex bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex-wrap gap-3`}>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Mes</label>
          <select className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setPage(1) }}>
            <option value="">Todos los meses</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{format(new Date(m + '-01'), 'MMMM yyyy', { locale: es })}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Categoría</label>
          <select className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}>
            <option value="">Todas las categorías</option>
            <option value="sin-categoria">Sin categoría</option>
            {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Subcategoría</label>
          <select className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={filterSubcategory} onChange={(e) => { setFilterSubcategory(e.target.value); setPage(1) }}>
            <option value="">Todas</option>
            <option value="sin-subcategoria">Sin subcategoría</option>
            {(filterCategory && filterCategory !== 'sin-categoria'
              ? subcategories.filter((s) => s.categoriaId === filterCategory)
              : subcategories
            ).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Tipo</label>
          <select className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1) }}>
            <option value="">Todos</option>
            <option value="ingreso">Ingresos</option>
            <option value="gasto">Gastos</option>
          </select>
        </div>
        <div className="hidden lg:block">
          <label className="text-xs font-medium text-slate-500 block mb-1">Buscar</label>
          <input type="text" placeholder="Buscar en descripción..." value={filterText}
            onChange={(e) => { setFilterText(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-56" />
        </div>
        <div className="flex items-end gap-3">
          <span className="text-sm text-slate-400 pb-1">{filtered.length} registros</span>
          {(activeFilterCount > 0 || filterText) && (
            <button onClick={() => { setFilterMonth(''); setFilterCategory(''); setFilterSubcategory(''); setFilterType(''); setFilterText(''); setPage(1) }}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline pb-1">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          className="fixed lg:static left-2 right-2 z-40 shadow-lg lg:shadow-none bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 lg:mb-4 flex flex-wrap items-center gap-3"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
        >
          <span className="text-sm font-semibold text-indigo-700">
            {selected.size} movimiento{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
          </span>
          <select className="border border-indigo-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={bulkCategory} onChange={(e) => { setBulkCategory(e.target.value); setBulkSubcategory('') }}>
            <option value="">— Categoría —</option>
            {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {bulkCategory && (() => {
            const subs = subcategories.filter((s) => s.categoriaId === bulkCategory)
            return subs.length > 0 ? (
              <select className="border border-indigo-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={bulkSubcategory} onChange={(e) => setBulkSubcategory(e.target.value)}>
                <option value="">— Subcategoría —</option>
                {subs.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            ) : null
          })()}
          <button onClick={applyBulkCategory} disabled={!bulkCategory && !bulkSubcategory}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
            Aplicar
          </button>
          <button onClick={() => { setSelected(new Set()); setBulkCategory(''); setBulkSubcategory('') }}
            className="text-xs text-indigo-500 hover:text-indigo-700 ml-auto">
            ✕ Cancelar<span className="hidden lg:inline"> selección</span>
          </button>
        </div>
      )}

      {/* Mobile: tarjetas por día (pb: hueco para el botón flotante) */}
      <div className={`lg:hidden ${selected.size > 0 ? 'pb-32' : 'pb-16'}`}>
        {paginated.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
            {transactions.length === 0
              ? 'No hay movimientos. Importa un extracto bancario o añade uno manualmente.'
              : 'No hay movimientos con los filtros actuales.'}
          </div>
        ) : (
          <TransactionCardList
            transactions={paginated}
            categories={categories}
            subcategories={subcategories}
            accounts={accounts}
            selected={selected}
            onOpen={(t) => setOpenTxId(t.id)}
            onToggleSelect={toggleSelect}
          />
        )}
      </div>

      {/* Table */}
      <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {paginated.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            {transactions.length === 0
              ? 'No hay movimientos. Importa un extracto bancario o añade uno manualmente.'
              : 'No hay movimientos con los filtros actuales.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 cursor-pointer select-none hover:text-indigo-600"
                    onClick={() => toggleSort('fechaContable')}>
                    Fecha<SortIcon col="fechaContable" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600 cursor-pointer select-none hover:text-indigo-600"
                    onClick={() => toggleSort('descripcion')}>
                    Descripción<SortIcon col="descripcion" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600 cursor-pointer select-none hover:text-indigo-600"
                    onClick={() => toggleSort('importe')}>
                    Importe<SortIcon col="importe" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Saldo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Cuenta</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Categoría</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Subcategoría</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((t) => {
                  const isSelected = selected.has(t.id)
                  const acc = accounts.find((a) => a.id === t.accountId)
                  return (
                    <tr key={t.id} className={`border-b border-slate-100 last:border-b-0 transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3 w-10">
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(t.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300" />
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(t.fechaContable)}
                        {t.esManual && <span className="ml-1 text-xs text-indigo-400 italic">manual</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={t.descripcion}>
                        {t.descripcion || '—'}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${t.importe >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatEur(t.importe)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                        {t.saldo != null && t.saldo !== 0 ? formatEur(t.saldo) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {acc ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: acc.color + '22', color: acc.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: acc.color }} />
                            {acc.nombre}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 max-w-[140px]"
                          value={t.categoria || ''}
                          onChange={(e) => changeCategory(t, e.target.value)}
                        >
                          <option value="">Sin categoría</option>
                          {sortedCategories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const subs = t.categoria ? subcategories.filter((s) => s.categoriaId === t.categoria) : []
                          return t.categoria ? (
                            <select
                              className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 max-w-[130px]"
                              value={t.subcategoria || ''}
                              onChange={(e) => changeSubcategory(t, e.target.value)}
                            >
                              <option value="">—</option>
                              {subs.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                              <option value="__new__">＋ Nueva...</option>
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3 w-16">
                        {t.esManual && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditingTx(t)}
                              className="text-indigo-400 hover:text-indigo-600 transition-colors px-1"
                              title="Editar"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button
                              onClick={async () => { if (window.confirm('¿Eliminar este movimiento?')) await deleteTransaction(t.id) }}
                              className="text-red-400 hover:text-red-600 transition-colors text-sm px-1"
                              title="Eliminar"
                            >✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-slate-500">{page} / {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
              Anterior
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed">
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Mobile: botón flotante de alta */}
      {selected.size === 0 && <button
        onClick={() => setShowManual(true)}
        className="lg:hidden fixed right-4 z-40 w-14 h-14 rounded-full bg-indigo-600 active:bg-indigo-700 text-white text-3xl leading-none shadow-lg"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        aria-label="Añadir movimiento"
      >
        +
      </button>}

      {openTx && (
        <TransactionSheet
          transaction={openTx}
          categories={sortedCategories}
          subcategories={subcategories}
          accounts={accounts}
          onChangeCategory={changeCategory}
          onChangeSubcategory={changeSubcategory}
          onEdit={(t) => { setOpenTxId(null); setEditingTx(t) }}
          onDelete={async (t) => {
            if (window.confirm('¿Eliminar este movimiento?')) { await deleteTransaction(t.id); setOpenTxId(null) }
          }}
          onClose={() => setOpenTxId(null)}
        />
      )}

      {/* Modals */}
      {showManual && (
        <ManualTransactionModal
          accounts={accounts}
          categories={categories}
          defaultAccountId={activeAccountId !== '__all__' ? activeAccountId : accounts[0]?.id}
          onSave={async (tx) => { await addManualTransaction(tx); setShowManual(false) }}
          onClose={() => setShowManual(false)}
        />
      )}
      {editingTx && (
        <ManualTransactionModal
          accounts={accounts}
          categories={categories}
          initialData={editingTx}
          onSave={async (tx) => { await updateTransaction(editingTx.id, tx); setEditingTx(null) }}
          onClose={() => setEditingTx(null)}
        />
      )}
      {showAccounts && (
        <AccountsModal
          accounts={accounts}
          onAdd={addAccount}
          onDelete={deleteAccount}
          onClose={() => setShowAccounts(false)}
        />
      )}
    </div>
  )
}
