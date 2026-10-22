import { useState, useRef, useCallback } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useSubcategoryStore from '../store/useSubcategoryStore'
import useAccountStore from '../store/useAccountStore'
import { parseFile, mapRows } from '../utils/importParsers'
import { autoCategorize } from '../utils/categorize'
import { handleTransferPairing } from '../utils/transferPairing'
import db from '../db/db'
import { exportFullBackup, saveBackupJson } from '../utils/exportData'
import { isMobile } from '../platform'
import { createBackup, listBackups, restoreBackup, deleteBackup, backupToJson } from '../utils/backupManager'
import useBudgetStore from '../store/useBudgetStore'
import useRecurringStore from '../store/useRecurringStore'
import SelectSheet from '../components/SelectSheet'
import { TransactionCardList } from '../components/TransactionList.mobile'

const REQUIRED_FIELDS = ['fechaContable', 'descripcion', 'importe']

function formatEur(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function Importar() {
  const allTransactions = useTransactionStore((s) => s.transactions)
  const addTransactions = useTransactionStore((s) => s.addTransactions)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const addManualTransaction = useTransactionStore((s) => s.addManualTransaction)
  const deleteTransaction = useTransactionStore((s) => s.deleteTransaction)
  const clearAll = useTransactionStore((s) => s.clearAll)
  const totalTransactions = allTransactions.length
  const categories = useCategoryStore((s) => s.categories)
  const subcategories = useSubcategoryStore((s) => s.subcategories)
  const accounts = useAccountStore((s) => s.accounts)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importAccountId, setImportAccountId] = useState('')

  const [backupStatus, setBackupStatus] = useState(null) // null | 'restoring' | 'ok' | 'error'
  const backupRef = useRef()
  const [backupHistory, setBackupHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [restoringId, setRestoringId] = useState(null)

  async function refreshBackupHistory() {
    setBackupHistory(await listBackups())
  }

  async function handleImportBackup(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBackupStatus('restoring')
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      if (!payload.version || !payload.transactions || !payload.categories) throw new Error('Formato de backup no válido')
      await createBackup('auto: antes de restaurar archivo')
      await db.transaction('rw', db.transactions, db.categories, db.subcategories, db.accounts, db.budgets, async () => {
        await db.transactions.clear()
        await db.categories.clear()
        await db.subcategories.clear()
        await db.accounts.clear()
        await db.budgets.clear()
        if (payload.transactions.length)  await db.transactions.bulkPut(payload.transactions)
        if (payload.categories.length)    await db.categories.bulkPut(payload.categories)
        if (payload.subcategories?.length) await db.subcategories.bulkPut(payload.subcategories)
        if (payload.accounts?.length)     await db.accounts.bulkPut(payload.accounts)
        if (payload.budgets?.length)            await db.budgets.bulkPut(payload.budgets)
        if (payload.recurringExpenses?.length)  await db.recurringExpenses.bulkPut(payload.recurringExpenses)
      })
      // Reload all stores from DB
      await Promise.all([
        useTransactionStore.getState().loadFromDB(),
        useCategoryStore.getState().loadFromDB(),
        useSubcategoryStore.getState().loadFromDB(),
        useAccountStore.getState().loadFromDB(),
        useBudgetStore.getState().loadFromDB(),
        useRecurringStore.getState().loadFromDB(),
      ])
      setBackupStatus('ok')
    } catch (err) {
      console.error(err)
      setBackupStatus('error')
    }
    e.target.value = ''
  }

  const [step, setStep] = useState('upload') // upload | mapping | preview | done
  const [rawRows, setRawRows] = useState([])
  const [columns, setColumns] = useState([])
  const [mapping, setMapping] = useState({ fechaContable: '', fechaValor: '', descripcion: '', importe: '', saldo: '' })
  const [mappedRows, setMappedRows] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')
  const [importedCount, setImportedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [previewSelected, setPreviewSelected] = useState(new Set())
  const [previewBulkCat, setPreviewBulkCat] = useState('')
  const [previewBulkSub, setPreviewBulkSub] = useState('')
  const fileRef = useRef()

  const handleFile = async (file) => {
    setError('')
    try {
      const rows = await parseFile(file)
      if (!rows.length) throw new Error('El archivo está vacío')
      setRawRows(rows)
      setColumns(Object.keys(rows[0]))
      // Auto-guess mapping
      const guessMapping = (keys) => {
        const find = (hints) => keys.find((k) => hints.some((h) => k.toLowerCase().includes(h))) || ''
        return {
          fechaContable: find(['fecha contable', 'f. contable', 'fecha_contable', 'fecha', 'date', 'f.contable']),
          fechaValor: find(['fecha valor', 'f. valor', 'fecha_valor', 'valor']),
          descripcion: find(['concepto', 'descripcion', 'descripción', 'description', 'movimiento', 'comercio']),
          importe: find(['importe', 'cantidad', 'amount', 'cargo', 'abono']),
          saldo: find(['saldo', 'balance']),
        }
      }
      setMapping(guessMapping(Object.keys(rows[0])))
      setStep('mapping')
    } catch (e) {
      setError(e.message || 'Error al procesar el archivo')
    }
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = () => setIsDragging(false)

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    e.target.value = '' // permite volver a elegir el mismo archivo (p. ej. tras un error)
    if (file) handleFile(file)
  }

  const handleMapping = (field, value) => {
    setMapping((m) => ({ ...m, [field]: value }))
  }

  const handlePreview = () => {
    const missing = REQUIRED_FIELDS.filter((f) => !mapping[f])
    if (missing.length) {
      setError(`Asigna los campos obligatorios: ${missing.join(', ')}`)
      return
    }
    setError('')
    const rows = mapRows(rawRows, mapping)
    const categorized = autoCategorize(rows, categories, subcategories)
    setMappedRows(categorized)
    setStep('preview')
  }

  function togglePreviewSelect(i) {
    setPreviewSelected((prev) => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }
  function togglePreviewSelectAll() {
    if (previewSelected.size === mappedRows.length) setPreviewSelected(new Set())
    else setPreviewSelected(new Set(mappedRows.map((_, i) => i)))
  }
  function applyPreviewBulk() {
    if ((!previewBulkCat && !previewBulkSub) || previewSelected.size === 0) return
    setMappedRows((rows) => rows.map((r, i) => {
      if (!previewSelected.has(i)) return r
      const updates = { ...r }
      if (previewBulkCat) updates.categoria = previewBulkCat
      if (previewBulkSub) updates.subcategoria = previewBulkSub
      return updates
    }))
    setPreviewSelected(new Set())
    setPreviewBulkCat('')
    setPreviewBulkSub('')
  }

  const handleImport = async () => {
    const accountId = importAccountId || accounts[0]?.id || null
    const rows = accountId ? mappedRows.map((t) => ({ ...t, accountId })) : mappedRows
    const added = await addTransactions(rows)
    setImportedCount(added)
    setSkippedCount(mappedRows.length - added)

    // Pair imported transactions that were auto-categorised as internal transfers
    const transferCatIds = new Set(categories.filter((c) => c.esTransferencia).map((c) => c.id))
    const freshTx = useTransactionStore.getState().transactions
    const storeActions = { updateTransaction, addManualTransaction, deleteTransaction }
    for (const row of rows) {
      if (!transferCatIds.has(row.categoria)) continue
      const imported = freshTx.find((t) => t.id === row.id)
      if (imported) {
        await handleTransferPairing(imported, freshTx, categories, subcategories, accounts, storeActions)
      }
    }

    setStep('done')
  }

  const handleReset = () => {
    setStep('upload')
    setRawRows([])
    setColumns([])
    setMapping({ fechaContable: '', fechaValor: '', descripcion: '', importe: '', saldo: '' })
    setMappedRows([])
    setError('')
    setImportedCount(0)
    if (fileRef.current) fileRef.current.value = ''
  }

  const FIELD_LABELS = {
    fechaContable: { label: 'Fecha contable', required: true },
    fechaValor: { label: 'Fecha valor', required: false },
    descripcion: { label: 'Descripción', required: true },
    importe: { label: 'Importe', required: true },
    saldo: { label: 'Saldo', required: false },
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Importar movimientos</h1>
          <p className="text-slate-500 text-sm mt-1">Importa un extracto bancario en PDF, CSV o Excel</p>
        </div>
        {totalTransactions > 0 && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {confirmClear ? (
              <>
                <span className="text-sm text-red-600">¿Eliminar {totalTransactions} movimientos?</span>
                <button
                  onClick={async () => { await createBackup('auto: antes de borrar datos'); await clearAll(); setConfirmClear(false) }}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                >Sí, eliminar</button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >Cancelar</button>
              </>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
              >Borrar todos los datos</button>
            )}
          </div>
        )}
      </div>

      {/* Backup / restore panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <p className="text-sm font-semibold text-slate-700 mb-1">Copia de seguridad</p>
        <p className="text-xs text-slate-400 mb-4">Exporta todos tus datos (movimientos, categorías y subcategorías) a un fichero JSON para guardarlos o migrarlos a otra instalación.</p>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={exportFullBackup}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            ⬇ Exportar backup
          </button>
          <button
            onClick={() => backupRef.current?.click()}
            className="px-4 py-2 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
          >
            ⬆ Restaurar backup
          </button>
          <input ref={backupRef} type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
          <button
            onClick={() => { refreshBackupHistory(); setShowHistory((v) => !v) }}
            className="px-4 py-2 text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
          >
            {showHistory ? 'Ocultar historial' : 'Historial de backups'}
          </button>
          {backupStatus === 'restoring' && <span className="text-xs text-slate-400 animate-pulse">Restaurando…</span>}
          {backupStatus === 'ok'        && <span className="text-xs text-emerald-600 font-medium">✓ Backup restaurado correctamente</span>}
          {backupStatus === 'error'     && <span className="text-xs text-red-600 font-medium">✗ Error al restaurar — comprueba que el fichero es un backup válido</span>}
        </div>

        {/* Backup history */}
        {showHistory && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-600 mb-2">Historial de copias de seguridad (max. 10)</p>
            {backupHistory.length === 0 ? (
              <p className="text-xs text-slate-400">No hay copias de seguridad guardadas.</p>
            ) : (
              <div className="space-y-2">
                {backupHistory.map((b) => (
                  <div key={b.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">
                        {new Date(b.createdAt).toLocaleString('es-ES')}
                        <span className="ml-2 text-slate-400 font-normal">{b.reason}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {b.stats.transactions} mov · {b.stats.categories} cat · {b.stats.subcategories} subcat · {b.stats.accounts} cuentas
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3 shrink-0">
                      <button
                        onClick={async () => {
                          const json = JSON.stringify(backupToJson(b), null, 2)
                          await saveBackupJson(`cuadra-backup-${b.createdAt.slice(0, 10)}.json`, json)
                        }}
                        className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-white transition-colors"
                      >
                        Descargar
                      </button>
                      <button
                        disabled={restoringId === b.id}
                        onClick={async () => {
                          if (!confirm(`¿Restaurar la copia del ${new Date(b.createdAt).toLocaleString('es-ES')}? Se creará una copia de seguridad del estado actual antes de restaurar.`)) return
                          setRestoringId(b.id)
                          try {
                            await restoreBackup(b.id)
                            await Promise.all([
                              useTransactionStore.getState().loadFromDB(),
                              useCategoryStore.getState().loadFromDB(),
                              useSubcategoryStore.getState().loadFromDB(),
                              useAccountStore.getState().loadFromDB(),
                            ])
                            setBackupStatus('ok')
                            await refreshBackupHistory()
                          } catch {
                            setBackupStatus('error')
                          }
                          setRestoringId(null)
                        }}
                        className="text-[11px] px-2 py-1 rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                      >
                        {restoringId === b.id ? 'Restaurando…' : 'Restaurar'}
                      </button>
                      <button
                        onClick={async () => {
                          await deleteBackup(b.id)
                          await refreshBackupHistory()
                        }}
                        className="text-[11px] px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        {['upload', 'mapping', 'preview', 'done'].map((s, i) => {
          const labels = ['Subir archivo', 'Mapear columnas', 'Vista previa', 'Listo']
          const isActive = step === s
          const isDone = ['upload', 'mapping', 'preview', 'done'].indexOf(step) > i
          return (
            <span key={s} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive ? 'bg-indigo-600 text-white' : isDone ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'
              }`}>{isDone && !isActive ? '✓' : i + 1}</span>
              <span className={`whitespace-nowrap ${isActive ? 'text-indigo-600 font-medium' : 'hidden sm:inline text-slate-400'}`}>{labels[i]}</span>
              {i < 3 && <span className="text-slate-300">›</span>}
            </span>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step: upload */}
      {step === 'upload' && (
        <div
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-colors cursor-pointer ${
            isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50'
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current?.click()}
        >
          <div className="text-4xl mb-3">📂</div>
          <p className="text-slate-700 font-medium">{isMobile ? 'Toca para elegir tu extracto' : 'Arrastra tu archivo aquí'}</p>
          {!isMobile && <p className="text-slate-400 text-sm mt-1">o haz clic para seleccionarlo</p>}
          <p className="text-slate-400 text-xs mt-3">Formatos soportados: PDF, CSV, XLSX, XLS</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.xls,application/pdf"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      )}

      {/* Step: mapping */}
      {step === 'mapping' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">Mapear columnas</h2>
          <p className="text-sm text-slate-500 mb-5">
            Se encontraron {rawRows.length} filas. Asigna las columnas del archivo a los campos de la aplicación.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(FIELD_LABELS).map(([field, { label, required }]) => (
              <div key={field}>
                <label className="text-sm font-medium text-slate-600 block mb-1">
                  {label} {required && <span className="text-red-500">*</span>}
                </label>
                <SelectSheet title={`Columna para «${label}»`} value={mapping[field]} onChange={(v) => handleMapping(field, v)} className="w-full py-2"
                  options={[{ value: '', label: '— No mapear —' }, ...columns.map((col) => ({ value: col, label: col }))]} />
              </div>
            ))}
          </div>

          {/* Raw preview */}
          <div className="mt-6">
            <p className="text-xs font-medium text-slate-500 mb-2">Primeras 3 filas del archivo:</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="text-xs w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {columns.map((c) => (
                      <th key={c} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {columns.map((c) => (
                        <td key={c} className="px-3 py-2 text-slate-600 max-w-[120px] truncate">{String(row[c] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              Atrás
            </button>
            <button
              onClick={handlePreview}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              Vista previa →
            </button>
          </div>
        </div>
      )}

      {/* Step: preview */}
      {step === 'preview' && (
        <div className="lg:bg-white lg:rounded-xl lg:border lg:border-slate-200 lg:shadow-sm lg:p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">Vista previa</h2>
          <p className="text-sm text-slate-500 mb-5">
            {mappedRows.length} movimientos listos para importar. Se aplicó categorización automática.
            <span className="block text-xs text-slate-400 mt-1">
              <span className="lg:hidden">Toca los movimientos para seleccionarlos y cambiar su categoría antes de importar.</span>
              <span className="hidden lg:inline">Selecciona movimientos para cambiar categoría/subcategoría en lote antes de importar.</span>
            </span>
          </p>

          {/* Bulk action bar */}
          {previewSelected.size > 0 && (
            <div className="fixed lg:static left-2 right-2 z-40 shadow-lg lg:shadow-none bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 lg:mb-4 flex flex-wrap items-center gap-3"
              style={{ bottom: 'calc(4.5rem + var(--sab))' }}>
              <span className="text-sm font-semibold text-indigo-700">
                {previewSelected.size} seleccionado{previewSelected.size !== 1 ? 's' : ''}
              </span>
              <SelectSheet title="Categoría" value={previewBulkCat} onChange={(v) => { setPreviewBulkCat(v); setPreviewBulkSub('') }}
                options={[{ value: '', label: '— Categoría —' }, ...[...categories].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((c) => ({ value: c.id, label: c.nombre, color: c.color }))]} />
              {previewBulkCat && (() => {
                const subs = subcategories.filter((s) => s.categoriaId === previewBulkCat)
                return subs.length > 0 ? (
                  <SelectSheet title="Subcategoría" value={previewBulkSub} onChange={setPreviewBulkSub}
                    options={[{ value: '', label: '— Subcategoría —' }, ...subs.map((s) => ({ value: s.id, label: s.nombre }))]} />
                ) : null
              })()}
              <button onClick={applyPreviewBulk} disabled={!previewBulkCat && !previewBulkSub}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
                Aplicar
              </button>
              <button onClick={() => { setPreviewSelected(new Set()); setPreviewBulkCat(''); setPreviewBulkSub('') }}
                className="text-xs text-indigo-500 hover:text-indigo-700 ml-auto">
                ✕ Cancelar
              </button>
            </div>
          )}

          {/* Móvil: tarjetas (tocar = seleccionar) */}
          <div className={`lg:hidden ${previewSelected.size > 0 ? 'pb-28' : ''}`}>
            <button onClick={togglePreviewSelectAll} className="mb-3 text-sm font-medium text-indigo-600">
              {previewSelected.size === mappedRows.length && mappedRows.length > 0 ? 'Quitar selección' : 'Seleccionar todos'}
            </button>
            <TransactionCardList
              transactions={mappedRows}
              categories={categories}
              subcategories={subcategories}
              accounts={[]}
              selected={new Set([...previewSelected].map((i) => mappedRows[i]?.id))}
              onOpen={(t) => togglePreviewSelect(mappedRows.indexOf(t))}
              onToggleSelect={(id) => togglePreviewSelect(mappedRows.findIndex((r) => r.id === id))}
            />
          </div>

          <div className="hidden lg:block overflow-x-auto rounded-lg border border-slate-200 max-h-80 overflow-y-auto">
            <table className="text-sm w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-center">
                    <input type="checkbox" checked={previewSelected.size === mappedRows.length && mappedRows.length > 0}
                      onChange={togglePreviewSelectAll} className="accent-indigo-600" />
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Descripción</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Importe</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Categoría</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Subcategoría</th>
                </tr>
              </thead>
              <tbody>
                {mappedRows.map((row, i) => {
                  const cat = categories.find((c) => c.id === row.categoria)
                  const sub = subcategories.find((s) => s.id === row.subcategoria)
                  return (
                    <tr key={i} className={`border-t border-slate-100 ${previewSelected.has(i) ? 'bg-indigo-50' : ''}`}>
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={previewSelected.has(i)}
                          onChange={() => togglePreviewSelect(i)} className="accent-indigo-600" />
                      </td>
                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{row.fechaContable}</td>
                      <td className="px-4 py-2 text-slate-700 max-w-xs truncate">{row.descripcion}</td>
                      <td className={`px-4 py-2 text-right font-medium ${row.importe >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatEur(row.importe)}
                      </td>
                      <td className="px-4 py-2">
                        {cat ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: cat.color + '22', color: cat.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                            {cat.nombre}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Sin categoría</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {sub ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: (sub.color || cat?.color || '#94a3b8') + '22', color: sub.color || cat?.color || '#94a3b8' }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sub.color || cat?.color || '#94a3b8' }} />
                            {sub.nombre}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-6 pb-2">
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              Atrás
            </button>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500">Importar en cuenta:</label>
              <SelectSheet title="Cuenta" value={importAccountId} onChange={setImportAccountId}
                options={accounts.map((a) => ({ value: a.id, label: a.nombre, color: a.color }))} />
            </div>
            <button
              onClick={handleImport}
              className="w-full lg:w-auto px-4 py-3 lg:py-2 text-sm rounded-xl lg:rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              Importar {mappedRows.length} movimientos
            </button>
          </div>
        </div>
      )}

      {/* Step: done */}
      {step === 'done' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            {importedCount} movimientos importados
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {skippedCount > 0 && (
              <span className="block text-amber-600 mb-1">
                {skippedCount} omitidos por ser duplicados (misma fecha, descripción e importe).
              </span>
            )}
            Puedes verlos en la sección <strong>Movimientos</strong> o volver al Dashboard.
          </p>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            Importar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}
