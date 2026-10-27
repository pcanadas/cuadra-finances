import { useState, useMemo, useRef, useEffect } from 'react'
import useCategoryStore from '../store/useCategoryStore'
import useTransactionStore from '../store/useTransactionStore'
import useAccountStore from '../store/useAccountStore'
import { categorizeTransaction } from '../utils/categorize'
import useSubcategoryStore from '../store/useSubcategoryStore'
import { handleTransferPairing, undoTransferPairing, describeTransferSync } from '../utils/transferPairing'
import SelectSheet from '../components/SelectSheet'

const PRESET_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#e11d48',
  '#22c55e', '#6366f1', '#ff9900', '#94a3b8', '#16a34a',
]

function CategoryCard({ category, onUpdate, onDelete, txCount, accounts }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Sync local state when the category prop changes externally (e.g. keyword added from suggestions)
  useEffect(() => {
    if (!editing) {
      setKeywords([...category.palabrasClave])
      setExclusions([...(category.palabrasExcluidas || [])])
      setNombre(category.nombre)
      setColor(category.color)
      setEsTransferencia(category.esTransferencia || false)
      setCuentaDestinoId(category.cuentaDestinoId || '')
    }
  }, [category])
  const [nombre, setNombre] = useState(category.nombre)
  const [keywords, setKeywords] = useState([...category.palabrasClave])
  const [exclusions, setExclusions] = useState([...(category.palabrasExcluidas || [])])
  const [color, setColor] = useState(category.color)
  const [esTransferencia, setEsTransferencia] = useState(category.esTransferencia || false)
  const [cuentaDestinoId, setCuentaDestinoId] = useState(category.cuentaDestinoId || '')
  const [newKw, setNewKw] = useState('')
  const [newEx, setNewEx] = useState('')
  const [editingKw, setEditingKw] = useState(null) // index being edited
  const [editingKwValue, setEditingKwValue] = useState('')

  const addKeyword = () => {
    const kw = newKw.trim().toUpperCase()
    if (kw && !keywords.includes(kw)) setKeywords((prev) => [...prev, kw])
    setNewKw('')
  }

  const handleKwKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addKeyword() }
  }

  const removeKeyword = (idx) => setKeywords((prev) => prev.filter((_, i) => i !== idx))

  const startEditKw = (idx) => {
    setEditingKw(idx)
    setEditingKwValue(keywords[idx])
  }

  const commitEditKw = (idx) => {
    const kw = editingKwValue.trim().toUpperCase()
    if (kw && !keywords.some((k, i) => k === kw && i !== idx)) {
      setKeywords((prev) => prev.map((k, i) => (i === idx ? kw : k)))
    }
    setEditingKw(null)
    setEditingKwValue('')
  }

  const handleEditKwKeyDown = (e, idx) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEditKw(idx) }
    if (e.key === 'Escape') { setEditingKw(null); setEditingKwValue('') }
  }

  const addExclusion = () => {
    const ex = newEx.trim().toUpperCase()
    if (ex && !exclusions.includes(ex)) setExclusions((prev) => [...prev, ex])
    setNewEx('')
  }

  const handleSave = async () => {
    await onUpdate(category.id, { nombre, palabrasClave: keywords, palabrasExcluidas: exclusions, color, esTransferencia, cuentaDestinoId: esTransferencia ? (cuentaDestinoId || null) : null })
    setEditing(false)
  }

  const handleCancel = () => {
    setNombre(category.nombre)
    setKeywords([...category.palabrasClave])
    setExclusions([...(category.palabrasExcluidas || [])])
    setColor(category.color)
    setEsTransferencia(category.esTransferencia || false)
    setCuentaDestinoId(category.cuentaDestinoId || '')
    setNewKw('')
    setNewEx('')
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Nombre</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Palabras clave</label>
            <div className="flex flex-wrap gap-1 mb-2 min-h-[28px]">
              {keywords.map((kw, idx) => (
                editingKw === idx ? (
                  <input
                    key={idx}
                    autoFocus
                    value={editingKwValue}
                    onChange={(e) => setEditingKwValue(e.target.value.toUpperCase())}
                    onKeyDown={(e) => handleEditKwKeyDown(e, idx)}
                    onBlur={() => commitEditKw(idx)}
                    className="px-2 py-0.5 rounded text-xs font-mono border focus:outline-none"
                    style={{ borderColor: color, color, width: `${Math.max(editingKwValue.length, 4) + 2}ch` }}
                  />
                ) : (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono"
                    style={{ backgroundColor: color + '22', color }}
                  >
                    <span
                      className="cursor-text hover:underline"
                      title="Clic para editar"
                      onClick={() => startEditKw(idx)}
                    >{kw}</span>
                    <button
                      onClick={() => removeKeyword(idx)}
                      className="hover:opacity-60 leading-none"
                      title="Eliminar"
                    >×</button>
                  </span>
                )
              ))}
              {keywords.length === 0 && (
                <span className="text-xs text-slate-400 italic">Sin palabras clave</span>
              )}
            </div>
            <div className="flex gap-1">
              <input
                className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={newKw}
                onChange={(e) => setNewKw(e.target.value)}
                onKeyDown={handleKwKeyDown}
                placeholder="Nueva keyword y pulsa Enter"
              />
              <button
                onClick={addKeyword}
                className="px-3 py-1.5 text-xs rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
              >Añadir</button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">
              Excepciones{' '}
              <span className="font-normal text-slate-400">(si la descripción contiene esto, no entra en esta categoría)</span>
            </label>
            <div className="flex flex-wrap gap-1 mb-2 min-h-[28px]">
              {exclusions.map((ex, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-red-50 text-red-600 border border-red-200"
                >
                  <span>≠ {ex}</span>
                  <button
                    onClick={() => setExclusions((prev) => prev.filter((_, i) => i !== idx))}
                    className="hover:opacity-60 leading-none"
                    title="Eliminar excepción"
                  >×</button>
                </span>
              ))}
              {exclusions.length === 0 && (
                <span className="text-xs text-slate-400 italic">Sin excepciones</span>
              )}
            </div>
            <div className="flex gap-1">
              <input
                className="flex-1 border border-red-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-red-50/30"
                value={newEx}
                onChange={(e) => setNewEx(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addExclusion() } }}
                placeholder="Ej: REGISTRADORES y pulsa Enter"
              />
              <button
                onClick={addExclusion}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-medium"
              >Añadir</button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color === c ? 'border-slate-800 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0"
                title="Color personalizado"
              />
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={esTransferencia}
                onChange={(e) => { setEsTransferencia(e.target.checked); if (!e.target.checked) setCuentaDestinoId('') }}
                className="rounded border-slate-300"
              />
              Transferencia interna (excluir de gastos)
            </label>
            {esTransferencia && accounts.length > 0 && (
              <div className="ml-5">
                <label className="text-xs text-slate-500 block mb-1">Cuenta destino de la transferencia</label>
                <SelectSheet title="Cuenta destino" value={cuentaDestinoId} onChange={setCuentaDestinoId} className="text-xs"
                  options={[{ value: '', label: '— Sin especificar —' }, ...accounts.map((a) => ({ value: a.id, label: a.nombre, color: a.color }))]} />
                <p className="text-xs text-slate-400 mt-1">Cada movimiento de esta categoría aparecerá también en la cuenta destino (lo que sale de una entra en la otra). No cuenta como ingreso ni como gasto.</p>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              Guardar
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: category.color }}
              />
              <span className="font-semibold text-slate-700 text-sm truncate">{category.nombre}</span>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-2 py-1 rounded text-indigo-600 hover:bg-indigo-50"
              >
                Editar
              </button>
              {confirmDelete ? (
                <>
                  <button
                    onClick={() => onDelete(category.id)}
                    className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600"
                  >
                    Sí, borrar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs px-2 py-1 rounded text-red-500 hover:bg-red-50"
                >
                  Borrar
                </button>
              )}
            </div>
          </div>

          <div className="mt-2">
            {category.palabrasClave.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {category.palabrasClave.map((kw) => (
                  <span
                    key={kw}
                    className="inline-block px-2 py-0.5 rounded text-xs font-mono"
                    style={{ backgroundColor: category.color + '22', color: category.color }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">Sin palabras clave</span>
            )}
          </div>

          {category.palabrasExcluidas?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {category.palabrasExcluidas.map((ex) => (
                <span key={ex} className="inline-block px-2 py-0.5 rounded text-xs font-mono bg-red-50 text-red-500 border border-red-100">
                  ≠ {ex}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-400">{txCount} movimiento{txCount !== 1 ? 's' : ''}</span>
            {category.esTransferencia && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                Transferencia interna{(() => {
                  const dest = accounts.find((a) => a.id === category.cuentaDestinoId)
                  return dest ? ` → ${dest.nombre}` : ''
                })()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Categorias() {
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } = useCategoryStore()
  const dragIndex = useRef(null)

  const transactions = useTransactionStore((s) => s.transactions)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const bulkUpdateTransactions = useTransactionStore((s) => s.bulkUpdateTransactions)
  const addManualTransaction = useTransactionStore((s) => s.addManualTransaction)
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)
  const accounts = useAccountStore((s) => s.accounts)
  const subcategories = useSubcategoryStore((s) => s.subcategories)

  const [showForm, setShowForm] = useState(false)
  const [recatResult, setRecatResult] = useState(null)
  const [recatLoading, setRecatLoading] = useState(false)
  const [transferNotice, setTransferNotice] = useState(null)

  // Tras cambiar categorías de traspaso: contrapartidas al día con su cuenta destino
  async function syncTransfers() {
    const result = await useTransactionStore.getState().syncTransferCounterparts(
      useCategoryStore.getState().categories, useSubcategoryStore.getState().subcategories, useAccountStore.getState().accounts)
    setTransferNotice(describeTransferSync(result))
  }

  // Dismissed suggestions persisted in localStorage as "catId::keyword"
  const [dismissedSuggestions, setDismissedSuggestions] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('cuadra-dismissed-suggestions') || '[]')) }
    catch { return new Set() }
  })

  const dismissSuggestion = (catId, kw) => {
    setDismissedSuggestions((prev) => {
      const next = new Set(prev)
      next.add(`${catId}::${kw}`)
      localStorage.setItem('cuadra-dismissed-suggestions', JSON.stringify([...next]))
      return next
    })
  }

  const handleRecategorize = () => {
    setRecatLoading(true)
    setRecatResult(null)
    setTimeout(async () => {
      const freshCategories = useCategoryStore.getState().categories
      const freshTransactions = useTransactionStore.getState().transactions
      const transferCatIds = new Set(freshCategories.filter((c) => c.esTransferencia).map((c) => c.id))
      const updatesMap = {}
      freshTransactions.forEach((t) => {
        if (t.categoriaManual) return
        const cat = categorizeTransaction(t.descripcion, freshCategories)
        if (cat !== t.categoria) updatesMap[t.id] = { categoria: cat }
      })
      const updated = Object.keys(updatesMap).length
      if (updated > 0) await bulkUpdateTransactions(updatesMap)

      // Handle transfer pairing for newly categorised transfers
      const storeActions = { updateTransaction, addManualTransaction, deleteTransaction }
      const latestTx = useTransactionStore.getState().transactions
      for (const [id, updates] of Object.entries(updatesMap)) {
        const tx = latestTx.find((t) => t.id === id)
        if (!tx) continue
        const oldTx = freshTransactions.find((t) => t.id === id)
        const wasTransfer = oldTx && transferCatIds.has(oldTx.categoria)
        const isTransfer = transferCatIds.has(updates.categoria)
        if (!wasTransfer && isTransfer) {
          await handleTransferPairing(tx, latestTx, freshCategories, subcategories, accounts, storeActions)
        } else if (wasTransfer && !isTransfer && oldTx) {
          await undoTransferPairing(oldTx, latestTx, storeActions)
        }
      }

      await syncTransfers()
      setRecatResult(updated)
      setRecatLoading(false)
    }, 0)
  }
  const [newNombre, setNewNombre] = useState('')
  const [newKeywords, setNewKeywords] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])

  const txCountByCategory = {}
  transactions.forEach((t) => {
    if (t.categoria) txCountByCategory[t.categoria] = (txCountByCategory[t.categoria] || 0) + 1
  })

  // Suggestions: manual assignments whose description doesn't match any existing keyword
  const suggestions = useMemo(() => {
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))
    const sugg = {} // catId -> Set of candidate keywords

    transactions
      .filter((t) => t.categoriaManual && t.categoria && t.descripcion)
      .forEach((t) => {
        const cat = catMap[t.categoria]
        if (!cat) return
        const upper = t.descripcion.toUpperCase().replace(/\s+/g, ' ').trim()
        // Check if already matched by an existing keyword
        const alreadyMatched = cat.palabrasClave.some((kw) =>
          upper.includes(kw.toUpperCase().replace(/\s+/g, ' ').trim())
        )
        if (alreadyMatched) return
        // Extract a candidate: last meaningful word-group after "BIZUM A", "TRANSF /", etc.
        const cleaned = upper
          .replace(/^PAGO BIZUM A /, '')
          .replace(/^TRANS(F)? \//, '')
          .replace(/^RECIB(O)? \//, '')
          .split(/\s{2,}|\d{2}\/\d{2}\/\d{2}/)[0]
          .trim()
          .slice(0, 30)
        if (cleaned.length < 3) return
        if (!sugg[t.categoria]) sugg[t.categoria] = new Set()
        sugg[t.categoria].add(cleaned)
      })

    return Object.entries(sugg).map(([catId, kwSet]) => ({
      cat: catMap[catId],
      keywords: [...kwSet],
    }))
  }, [transactions, categories])

  const handleAdd = () => {
    if (!newNombre.trim()) return
    const palabrasClave = newKeywords
      .split(',')
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean)
    addCategory({ nombre: newNombre.trim(), palabrasClave, color: newColor })
    setNewNombre('')
    setNewKeywords('')
    setNewColor(PRESET_COLORS[0])
    setShowForm(false)
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Categorías</h1>
          <p className="text-slate-500 text-sm mt-1">
            Las palabras clave se usan para categorizar automáticamente los movimientos al importar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {transactions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {recatResult !== null && (
                <span className="text-sm text-green-600">{recatResult} movimientos actualizados</span>
              )}
              <button
                onClick={handleRecategorize}
                disabled={recatLoading}
                className="px-4 py-2 text-sm rounded-lg border border-indigo-300 text-indigo-600 font-medium hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {recatLoading ? 'Actualizando...' : 'Re-categorizar todo'}
              </button>
            </div>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            + Nueva categoría
          </button>
        </div>
      </div>

      {transferNotice && (
        <div className="mb-4 flex items-start gap-3 px-4 py-2.5 rounded-xl border border-green-200 bg-green-50 text-sm text-green-700">
          <span>⇄</span>
          <span className="flex-1">{transferNotice}</span>
          <button onClick={() => setTransferNotice(null)} className="text-green-700" aria-label="Cerrar">✕</button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Nueva categoría</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Nombre *</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Supermercados"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Palabras clave</label>
              <input
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                placeholder="MERCADONA, LIDL, DIA"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs font-medium text-slate-500 block mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    newColor === c ? 'border-slate-800 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAdd}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              Crear categoría
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (() => {
        const visibleSuggestions = suggestions
          .map(({ cat, keywords: kws }) => ({
            cat,
            keywords: kws.filter((kw) => !dismissedSuggestions.has(`${cat.id}::${kw}`)),
          }))
          .filter(({ keywords: kws }) => kws.length > 0)
        if (visibleSuggestions.length === 0) return null
        return (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-amber-800 mb-3">
              Sugerencias de palabras clave — basadas en asignaciones manuales
            </h3>
            <div className="space-y-2">
              {visibleSuggestions.map(({ cat, keywords: kws }) => (
                <div key={cat.id} className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700 min-w-[120px]">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.nombre}:
                  </span>
                  {kws.map((kw) => (
                    <span key={kw} className="inline-flex items-center rounded text-xs font-mono bg-white border border-amber-300 text-amber-700 overflow-hidden">
                      <button
                        onClick={() => { updateCategory(cat.id, { palabrasClave: [...cat.palabrasClave, kw] }); dismissSuggestion(cat.id, kw) }}
                        className="px-2 py-0.5 hover:bg-amber-100 transition-colors"
                        title="Añadir como palabra clave"
                      >
                        + {kw}
                      </button>
                      <button
                        onClick={() => dismissSuggestion(cat.id, kw)}
                        className="px-1.5 py-0.5 border-l border-amber-300 text-amber-400 hover:bg-red-50 hover:text-red-400 transition-colors leading-none"
                        title="Descartar sugerencia"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-3">Pulsa <strong>+ keyword</strong> para añadirla · <strong>×</strong> para descartarla.</p>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat, i) => (
          <div
            key={cat.id}
            draggable
            onDragStart={() => { dragIndex.current = i }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex.current !== null && dragIndex.current !== i) {
                reorderCategories(dragIndex.current, i)
              }
              dragIndex.current = null
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <CategoryCard
              category={cat}
              onUpdate={async (id, changes) => { await updateCategory(id, changes); await syncTransfers() }}
              onDelete={async (id) => { await deleteCategory(id); await syncTransfers() }}
              txCount={txCountByCategory[cat.id] || 0}
              accounts={accounts}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
