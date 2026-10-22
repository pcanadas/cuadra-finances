import { useState, useMemo, useRef } from 'react'
import { useBackHandler } from '../platform/back'
import useCategoryStore from '../store/useCategoryStore'
import useSubcategoryStore from '../store/useSubcategoryStore'
import useTransactionStore from '../store/useTransactionStore'
import useAccountStore from '../store/useAccountStore'
import { categorizeSubcategory, extractKeyword } from '../utils/categorize'
import SelectSheet from '../components/SelectSheet'

const PRESET_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#e11d48',
  '#16a34a', '#94a3b8', '#ff9900', '#22c55e', '#fbbf24',
]

const PAGE_SIZE = 15

// ─── keyword chip editor ─────────────────────────────────────────────────────

function KeywordEditor({ keywords, onChange }) {
  const [input, setInput] = useState('')
  const inputRef = useRef(null)

  function addKeyword(raw) {
    const kw = raw.trim().toUpperCase()
    if (!kw || keywords.map((k) => k.toUpperCase()).includes(kw)) return
    onChange([...keywords, kw])
    setInput('')
  }

  function removeKeyword(idx) {
    onChange(keywords.filter((_, i) => i !== idx))
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addKeyword(input)
    } else if (e.key === 'Backspace' && input === '' && keywords.length > 0) {
      removeKeyword(keywords.length - 1)
    }
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 items-center border border-slate-200 rounded-lg px-2 py-1.5 min-h-[36px] cursor-text bg-white"
      onClick={() => inputRef.current?.focus()}
    >
      {keywords.map((kw, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full"
        >
          {kw}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeKeyword(i) }}
            className="text-indigo-400 hover:text-indigo-700 leading-none"
          >×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => input.trim() && addKeyword(input)}
        placeholder={keywords.length === 0 ? 'Añadir etiqueta…' : ''}
        className="flex-1 min-w-[100px] text-xs outline-none bg-transparent text-slate-700 placeholder-slate-400"
      />
    </div>
  )
}

// ─── subcategory row ─────────────────────────────────────────────────────────

function SubcatRow({ sub, onSave, onDelete, isTransferCategory, accounts }) {
  const [editing, setEditing]   = useState(false)
  const [nombre, setNombre]     = useState(sub.nombre)
  const [keywords, setKeywords] = useState([...sub.palabrasClave])
  const [color, setColor]       = useState(sub.color ?? PRESET_COLORS[0])
  const [cuentaDestinoId, setCuentaDestinoId] = useState(sub.cuentaDestinoId || '')

  // sync if parent updates
  useMemo(() => {
    if (!editing) {
      setNombre(sub.nombre)
      setKeywords([...sub.palabrasClave])
      setColor(sub.color ?? PRESET_COLORS[0])
      setCuentaDestinoId(sub.cuentaDestinoId || '')
    }
  }, [sub])

  function handleSave() {
    onSave(sub.id, { nombre: nombre.trim(), palabrasClave: keywords, color, cuentaDestinoId: isTransferCategory ? (cuentaDestinoId || null) : null })
    setEditing(false)
  }

  function handleCancel() {
    setNombre(sub.nombre)
    setKeywords([...sub.palabrasClave])
    setColor(sub.color ?? PRESET_COLORS[0])
    setCuentaDestinoId(sub.cuentaDestinoId || '')
    setEditing(false)
  }

  return (
    <li className="px-4 py-3 border-b border-slate-100 last:border-b-0">
      {editing ? (
        <div className="space-y-2">
          {/* Name + color row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <input
              className="border border-slate-300 rounded px-2 py-1 text-sm w-40"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              autoFocus
            />
            <div className="flex items-center gap-1 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${color === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {/* Keywords */}
          <KeywordEditor keywords={keywords} onChange={setKeywords} />
          {/* Transfer destination */}
          {isTransferCategory && accounts.length > 0 && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">Cuenta destino</label>
              <SelectSheet title="Cuenta destino" value={cuentaDestinoId} onChange={setCuentaDestinoId} className="text-xs"
                options={[{ value: '', label: '— Sin especificar —' }, ...accounts.map((a) => ({ value: a.id, label: a.nombre, color: a.color }))]} />
            </div>
          )}
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md"
            >
              Guardar
            </button>
            <button
              onClick={handleCancel}
              className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1 rounded-md border border-slate-200"
            >
              Cancelar
            </button>
            <button
              onClick={() => onDelete(sub.id)}
              className="text-xs text-red-500 hover:text-red-700 px-3 py-1 rounded-md ml-auto"
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <span className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: sub.color }} />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-slate-700">{sub.nombre}</span>
            {sub.palabrasClave.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {sub.palabrasClave.map((kw, i) => (
                  <span key={i} className="inline-block bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-0.5 italic">Sin etiquetas</p>
            )}
            {isTransferCategory && sub.cuentaDestinoId && (() => {
              const dest = accounts.find((a) => a.id === sub.cuentaDestinoId)
              return dest ? (
                <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                  → {dest.nombre}
                </span>
              ) : null
            })()}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1 flex-shrink-0"
          >
            Editar
          </button>
        </div>
      )}
    </li>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Subcategorias() {
  const categories = useCategoryStore((s) => s.categories)
  const { subcategories, addSubcategory, updateSubcategory, deleteSubcategory } =
    useSubcategoryStore()
  const { transactions, updateTransaction } = useTransactionStore()
  const accounts = useAccountStore((s) => s.accounts)

  const [selectedCatId, setSelectedCatId] = useState(null)
  const [page, setPage] = useState(1)
  const [filterYear, setFilterYear] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterSubcat, setFilterSubcat] = useState('')
  const [filterText, setFilterText] = useState('')
  const [sortCol, setSortCol] = useState('fechaContable')
  const [sortDir, setSortDir] = useState('desc')

  // New subcategory form state
  const [newNombre, setNewNombre]     = useState('')
  const [newKeywords, setNewKeywords] = useState([])
  const [newColor, setNewColor]       = useState(PRESET_COLORS[0])
  const [newCuentaDestinoId, setNewCuentaDestinoId] = useState('')
  const [dismissedSubSugg, setDismissedSubSugg] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('cuadra-dismissed-sub-suggestions') || '[]')) }
    catch { return new Set() }
  })

  function dismissSubSuggestion(subId, kw) {
    setDismissedSubSugg((prev) => {
      const next = new Set(prev)
      next.add(`${subId}::${kw}`)
      localStorage.setItem('cuadra-dismissed-sub-suggestions', JSON.stringify([...next]))
      return next
    })
  }

  const selectedCategory = categories.find((c) => c.id === selectedCatId)
  // Móvil: atrás vuelve de la ficha a la lista de categorías
  useBackHandler(!!selectedCatId, () => setSelectedCatId(null))

  const catSubcats = useMemo(
    () => subcategories.filter((s) => s.categoriaId === selectedCatId),
    [subcategories, selectedCatId]
  )

  const catTransactions = useMemo(() => {
    if (!selectedCatId) return []
    return transactions.filter(
      (t) => t.categoria === selectedCatId || t.categoriaManual === selectedCatId
    )
  }, [transactions, selectedCatId])

  const subSuggestions = useMemo(() => {
    if (!selectedCatId || catSubcats.length === 0) return []
    const subMap = Object.fromEntries(catSubcats.map((s) => [s.id, s]))
    const sugg = {} // subId -> Set of candidate keywords

    catTransactions
      .filter((t) => t.subcategoriaManual && t.subcategoria && t.descripcion)
      .forEach((t) => {
        const sub = subMap[t.subcategoria]
        if (!sub) return
        const upper = t.descripcion.toUpperCase().replace(/\s+/g, ' ').trim()
        const alreadyMatched = sub.palabrasClave.some((kw) =>
          upper.includes(kw.toUpperCase().replace(/\s+/g, ' ').trim())
        )
        if (alreadyMatched) return
        const candidate = extractKeyword(t.descripcion)
        if (!candidate) return
        if (!sugg[t.subcategoria]) sugg[t.subcategoria] = new Set()
        sugg[t.subcategoria].add(candidate)
      })

    return Object.entries(sugg)
      .map(([subId, kwSet]) => ({
        sub: subMap[subId],
        keywords: [...kwSet].filter((kw) => !dismissedSubSugg.has(`${subId}::${kw}`)),
      }))
      .filter((s) => s.keywords.length > 0)
  }, [catTransactions, catSubcats, selectedCatId, dismissedSubSugg])

  const availableYears = useMemo(() => {
    const years = new Set(catTransactions.map((t) => new Date(t.fechaContable).getFullYear()))
    return [...years].sort((a, b) => b - a)
  }, [catTransactions])

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
    if (sortCol !== col) return <span className="text-slate-300 ml-0.5">⇅</span>
    return <span className="text-indigo-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const filteredTransactions = useMemo(() => {
    const filtered = catTransactions.filter((t) => {
      const d = new Date(t.fechaContable)
      if (filterYear && d.getFullYear() !== Number(filterYear)) return false
      if (filterMonth && d.getMonth() + 1 !== Number(filterMonth)) return false
      if (filterSubcat === '__none__' && t.subcategoria) return false
      if (filterSubcat && filterSubcat !== '__none__' && t.subcategoria !== filterSubcat) return false
      if (filterText && !t.descripcion.toLowerCase().includes(filterText.toLowerCase())) return false
      return true
    })
    filtered.sort((a, b) => {
      if (sortCol === 'fechaContable') {
        const av = new Date(a.fechaContable || 0).getTime()
        const bv = new Date(b.fechaContable || 0).getTime()
        return sortDir === 'asc' ? av - bv : bv - av
      } else if (sortCol === 'descripcion') {
        const av = (a.descripcion || '').toLowerCase()
        const bv = (b.descripcion || '').toLowerCase()
        return sortDir === 'asc' ? av.localeCompare(bv, 'es') : bv.localeCompare(av, 'es')
      } else if (sortCol === 'importe') {
        const av = a.importe ?? 0
        const bv = b.importe ?? 0
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return 0
    })
    return filtered
  }, [catTransactions, filterYear, filterMonth, filterSubcat, filterText, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE))
  const pagedTransactions = filteredTransactions.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )

  function handleSelectCategory(catId) {
    setSelectedCatId(catId)
    setPage(1)
    setNewNombre('')
    setNewKeywords([])
    setNewColor(PRESET_COLORS[0])
    setFilterYear('')
    setFilterMonth('')
    setFilterSubcat('')
    setFilterText('')
    setSortCol('fechaContable')
    setSortDir('desc')
  }

  async function handleAddSubcategory(e) {
    e.preventDefault()
    if (!newNombre.trim()) return
    await addSubcategory({
      categoriaId: selectedCatId,
      nombre: newNombre.trim(),
      palabrasClave: newKeywords,
      color: newColor,
      ...(selectedCategory?.esTransferencia && newCuentaDestinoId ? { cuentaDestinoId: newCuentaDestinoId } : {}),
    })
    setNewNombre('')
    setNewKeywords([])
    setNewColor(PRESET_COLORS[0])
    setNewCuentaDestinoId('')
  }

  async function handleAutoAssign() {
    const updatesMap = {}
    catTransactions.forEach((t) => {
      if (t.subcategoriaManual) return
      const subcatId = categorizeSubcategory(t.descripcion, catSubcats)
      if (subcatId && subcatId !== t.subcategoria) updatesMap[t.id] = { subcategoria: subcatId }
    })
    if (Object.keys(updatesMap).length > 0) {
      await useTransactionStore.getState().bulkUpdateTransactions(updatesMap)
    }
  }

  function formatDate(str) {
    if (!str) return ''
    return new Date(str).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function formatAmount(val) {
    if (val == null) return ''
    return Number(val).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
  }

  return (
    <div>
      <div className={`mb-6 ${selectedCategory ? 'hidden lg:block' : ''}`}>
        <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Subcategorías</h1>
        <p className="text-slate-500 text-sm mt-1">
          Organiza cada categoría en subcategorías más detalladas. Usa palabras clave para
          asignarlas automáticamente a tus movimientos.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left panel: category list (en móvil se oculta al abrir una categoría) */}
        <div className={`w-full lg:w-1/3 flex-shrink-0 ${selectedCategory ? 'hidden lg:block' : ''}`}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-sm font-semibold text-slate-600">Categorías</span>
            </div>
            <ul>
              {[...categories].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((cat) => {
                const count = subcategories.filter((s) => s.categoriaId === cat.id).length
                const isSelected = cat.id === selectedCatId
                return (
                  <li key={cat.id} className="border-b border-slate-100 last:border-b-0">
                    <button
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm font-medium">{cat.nombre}</span>
                      </div>
                      {count > 0 && (
                        <span className="text-xs bg-slate-100 text-slate-700 rounded-full px-2 py-0.5 font-medium">
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* Right panel (en móvil solo con una categoría elegida) */}
        <div className={`flex-1 min-w-0 ${selectedCategory ? '' : 'hidden lg:block'}`}>
          {!selectedCategory ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-center h-48">
              <p className="text-slate-400 text-sm">Selecciona una categoría para gestionar sus subcategorías</p>
            </div>
          ) : (
            <div className="space-y-6">
              <button onClick={() => setSelectedCatId(null)}
                className="lg:hidden text-sm text-indigo-600 font-medium -mb-2">
                ← Categorías
              </button>
              {/* Category header */}
              <div
                className="rounded-xl px-5 py-4 flex items-center gap-3"
                style={{ backgroundColor: selectedCategory.color + '22' }}
              >
                <span className="inline-block w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedCategory.color }} />
                <h2 className="text-lg font-bold" style={{ color: selectedCategory.color }}>
                  {selectedCategory.nombre}
                </h2>
              </div>

              {/* Subcategory list */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-600">
                    Subcategorías ({catSubcats.length})
                  </span>
                  <button
                    onClick={handleAutoAssign}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md transition-colors"
                  >
                    Auto-asignar subcategorías
                  </button>
                </div>

                {catSubcats.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-400 text-sm">
                    No hay subcategorías todavía. Añade una abajo.
                  </div>
                ) : (
                  <ul>
                    {catSubcats.map((sub) => (
                      <SubcatRow
                        key={sub.id}
                        sub={sub}
                        onSave={(id, updates) => updateSubcategory(id, updates)}
                        onDelete={(id) => deleteSubcategory(id)}
                        isTransferCategory={selectedCategory?.esTransferencia || false}
                        accounts={accounts}
                      />
                    ))}
                  </ul>
                )}

                {/* Add new subcategory form */}
                <form
                  onSubmit={handleAddSubcategory}
                  className="border-t border-slate-100 px-4 py-4 bg-slate-50 space-y-3"
                >
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Nueva subcategoría
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      className="border border-slate-300 rounded px-2 py-1.5 text-sm w-40"
                      placeholder="Nombre"
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      required
                    />
                    <div className="flex items-center gap-1 flex-wrap">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${newColor === c ? 'border-slate-700 scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <KeywordEditor keywords={newKeywords} onChange={setNewKeywords} />
                  {selectedCategory?.esTransferencia && accounts.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-slate-500">Cuenta destino:</label>
                      <SelectSheet title="Cuenta destino" value={newCuentaDestinoId} onChange={setNewCuentaDestinoId} className="text-xs"
                        options={[{ value: '', label: '— Sin especificar —' }, ...accounts.map((a) => ({ value: a.id, label: a.nombre, color: a.color }))]} />
                    </div>
                  )}
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded-md transition-colors"
                  >
                    Añadir subcategoría
                  </button>
                </form>
              </div>

              {/* Subcategory keyword suggestions */}
              {subSuggestions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-3">
                    💡 Sugerencias de palabras clave para subcategorías
                  </p>
                  <p className="text-xs text-amber-600 mb-3">
                    Basadas en movimientos asignados manualmente cuya descripción no coincide con ninguna palabra clave existente.
                  </p>
                  <div className="space-y-2">
                    {subSuggestions.map(({ sub, keywords }) => (
                      <div key={sub.id} className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: (sub.color || '#94a3b8') + '22', color: sub.color || '#94a3b8' }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sub.color || '#94a3b8' }} />
                          {sub.nombre}
                        </span>
                        {keywords.map((kw) => (
                          <span key={kw} className="inline-flex items-center gap-1 text-xs bg-white border border-amber-200 rounded-full px-2 py-0.5">
                            <button
                              className="text-green-600 hover:text-green-800 font-bold"
                              title="Añadir palabra clave"
                              onClick={() => updateSubcategory(sub.id, { palabrasClave: [...sub.palabrasClave, kw] })}
                            >+</button>
                            <span className="text-amber-800">{kw}</span>
                            <button
                              className="text-slate-400 hover:text-red-500"
                              title="Descartar sugerencia"
                              onClick={() => dismissSubSuggestion(sub.id, kw)}
                            >×</button>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transactions preview */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600 mr-2">
                    Movimientos ({filteredTransactions.length}{filteredTransactions.length !== catTransactions.length ? ` de ${catTransactions.length}` : ''})
                  </span>
                  <SelectSheet title="Año" value={String(filterYear)} onChange={(v) => { setFilterYear(v); setPage(1) }} className="text-xs"
                    options={[{ value: '', label: 'Todos los años' }, ...availableYears.map((y) => ({ value: String(y), label: String(y) }))]} />
                  <SelectSheet title="Mes" value={String(filterMonth)} onChange={(v) => { setFilterMonth(v); setPage(1) }} className="text-xs"
                    options={[{ value: '', label: 'Todos los meses' }, ...['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => ({ value: String(i + 1), label: m }))]} />
                  <SelectSheet title="Subcategoría" value={filterSubcat} onChange={(v) => { setFilterSubcat(v); setPage(1) }} className="text-xs"
                    options={[{ value: '', label: 'Todas las subcategorías' }, { value: '__none__', label: 'Sin subcategoría' }, ...catSubcats.map((s) => ({ value: s.id, label: s.nombre }))]} />
                  <input
                    type="text"
                    placeholder="Buscar descripción..."
                    value={filterText}
                    onChange={(e) => { setFilterText(e.target.value); setPage(1) }}
                    className="border border-slate-200 rounded px-2 py-1 text-xs flex-1 min-w-[140px]"
                  />
                  {(filterYear || filterMonth || filterSubcat || filterText) && (
                    <button
                      onClick={() => { setFilterYear(''); setFilterMonth(''); setFilterSubcat(''); setFilterText(''); setPage(1) }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >✕ Limpiar</button>
                  )}
                </div>

                {catTransactions.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-400 text-sm">
                    No hay movimientos en esta categoría.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50 text-left">
                            <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-indigo-600"
                              onClick={() => toggleSort('fechaContable')}>
                              Fecha<SortIcon col="fechaContable" />
                            </th>
                            <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer select-none hover:text-indigo-600"
                              onClick={() => toggleSort('descripcion')}>
                              Descripción<SortIcon col="descripcion" />
                            </th>
                            <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right cursor-pointer select-none hover:text-indigo-600"
                              onClick={() => toggleSort('importe')}>
                              Importe<SortIcon col="importe" />
                            </th>
                            <th className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subcategoría</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedTransactions.map((t) => (
                            <tr key={t.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{formatDate(t.fechaContable)}</td>
                              <td className="px-4 py-2 text-slate-700 max-w-xs truncate">{t.descripcion}</td>
                              <td className={`px-4 py-2 text-right whitespace-nowrap font-medium ${Number(t.importe) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {formatAmount(t.importe)}
                              </td>
                              <td className="px-4 py-2">
                                <SelectSheet title="Subcategoría" value={t.subcategoria || ''} className="text-xs"
                                  onChange={(val) => {
                                    updateTransaction(t.id, {
                                      subcategoria: val || null,
                                      subcategoriaManual: val ? true : false,
                                    })
                                    if (val) {
                                      const subcat = useSubcategoryStore.getState().subcategories.find((s) => s.id === val)
                                      if (subcat) {
                                        const kw = extractKeyword(t.descripcion)
                                        if (kw) {
                                          const upper = kw.toUpperCase()
                                          const alreadyHas = subcat.palabrasClave.some((k) => k.toUpperCase() === upper)
                                          if (!alreadyHas) {
                                            useSubcategoryStore.getState().updateSubcategory(val, {
                                              palabrasClave: [...subcat.palabrasClave, upper],
                                            })
                                          }
                                        }
                                      }
                                    }
                                  }}
                                  options={[{ value: '', label: '— Sin subcategoría —' }, ...catSubcats.map((sub) => ({ value: sub.id, label: sub.nombre }))]} />
                                {t.subcategoria && !t.subcategoriaManual && (
                                  <span className="ml-1 text-xs text-slate-400 italic">auto</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Página {page} de {totalPages}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                          >Anterior</button>
                          <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                          >Siguiente</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
