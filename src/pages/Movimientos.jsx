import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'

const PAGE_SIZE = 20

function formatEur(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function Movimientos() {
  const transactions = useTransactionStore((s) => s.transactions)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const bulkUpdateTransactions = useTransactionStore((s) => s.bulkUpdateTransactions)
  const categories = useCategoryStore((s) => s.categories)

  const [filterMonth, setFilterMonth] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterText, setFilterText] = useState('')
  const [page, setPage] = useState(1)

  // bulk selection
  const [selected, setSelected] = useState(new Set())
  const [bulkCategory, setBulkCategory] = useState('')

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

  const categoryMap = useMemo(() => {
    const map = {}
    categories.forEach((c) => (map[c.id] = c))
    return map
  }, [categories])

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [categories]
  )

  const filtered = useMemo(() => {
    let result = [...transactions].sort(
      (a, b) => new Date(b.fechaContable) - new Date(a.fechaContable)
    )
    if (filterMonth) result = result.filter((t) => t.fechaContable?.startsWith(filterMonth))
    if (filterCategory) {
      result = result.filter((t) =>
        filterCategory === 'sin-categoria' ? !t.categoria : t.categoria === filterCategory
      )
    }
    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase()
      result = result.filter((t) => t.descripcion?.toLowerCase().includes(q))
    }
    return result
  }, [transactions, filterMonth, filterCategory, filterText])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const pageIds = useMemo(() => paginated.map((t) => t.id), [paginated])
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        pageIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        pageIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  async function applyBulkCategory() {
    if (!bulkCategory || selected.size === 0) return
    const updatesMap = {}
    selected.forEach((id) => {
      updatesMap[id] = { categoria: bulkCategory, categoriaManual: true }
    })
    await bulkUpdateTransactions(updatesMap)
    setSelected(new Set())
    setBulkCategory('')
  }

  function clearSelection() {
    setSelected(new Set())
    setBulkCategory('')
  }

  const handleCategoryChange = async (id, catId) => {
    await updateTransaction(id, { categoria: catId || null, categoriaManual: true })
  }

  const formatDate = (iso) => {
    if (!iso) return '—'
    try { return format(new Date(iso), 'dd/MM/yyyy') } catch { return iso }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Movimientos</h1>
        <span className="text-sm text-slate-500">{filtered.length} registros</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-4 flex flex-wrap gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Mes</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={filterMonth}
            onChange={(e) => { setFilterMonth(e.target.value); setPage(1) }}
          >
            <option value="">Todos los meses</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {format(new Date(m + '-01'), 'MMMM yyyy', { locale: es })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Categoría</label>
          <select
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}
          >
            <option value="">Todas las categorías</option>
            <option value="sin-categoria">Sin categoría</option>
            {sortedCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Buscar</label>
          <input
            type="text"
            placeholder="Buscar en descripción..."
            value={filterText}
            onChange={(e) => { setFilterText(e.target.value); setPage(1) }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-56"
          />
        </div>
        {(filterMonth || filterCategory || filterText) && (
          <div className="flex items-end">
            <button
              onClick={() => { setFilterMonth(''); setFilterCategory(''); setFilterText(''); setPage(1) }}
              className="text-xs text-indigo-600 hover:text-indigo-800 underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-indigo-700">
            {selected.size} movimiento{selected.size !== 1 ? 's' : ''} seleccionado{selected.size !== 1 ? 's' : ''}
          </span>
          <select
            className="border border-indigo-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
          >
            <option value="">— Seleccionar categoría —</option>
            {sortedCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <button
            onClick={applyBulkCategory}
            disabled={!bulkCategory}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
          >
            Aplicar
          </button>
          <button
            onClick={clearSelection}
            className="text-xs text-indigo-500 hover:text-indigo-700 ml-auto"
          >
            ✕ Cancelar selección
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {paginated.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            {transactions.length === 0
              ? 'No hay movimientos. Importa un extracto bancario.'
              : 'No hay movimientos con los filtros actuales.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
                      title="Seleccionar todos en esta página"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Descripción</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Importe</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Saldo</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((t) => {
                  const isSelected = selected.has(t.id)
                  return (
                    <tr
                      key={t.id}
                      className={`border-b border-slate-100 last:border-b-0 transition-colors ${
                        isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(t.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(t.fechaContable)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={t.descripcion}>
                        {t.descripcion || '—'}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                        t.importe >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatEur(t.importe)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                        {t.saldo != null && t.saldo !== 0 ? formatEur(t.saldo) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 max-w-[140px]"
                          value={t.categoria || ''}
                          onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                        >
                          <option value="">Sin categoría</option>
                          {sortedCategories.map((c) => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
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
          <p className="text-sm text-slate-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
