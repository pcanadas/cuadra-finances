import { useState, useRef, useCallback } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useSubcategoryStore from '../store/useSubcategoryStore'
import { parseFile, mapRows } from '../utils/importParsers'
import { autoCategorize } from '../utils/categorize'
import db from '../db/db'

const REQUIRED_FIELDS = ['fechaContable', 'descripcion', 'importe']

function formatEur(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function Importar() {
  const addTransactions = useTransactionStore((s) => s.addTransactions)
  const clearAll = useTransactionStore((s) => s.clearAll)
  const totalTransactions = useTransactionStore((s) => s.transactions.length)
  const categories = useCategoryStore((s) => s.categories)
  const [confirmClear, setConfirmClear] = useState(false)

  const [backupStatus, setBackupStatus] = useState(null) // null | 'restoring' | 'ok' | 'error'
  const backupRef = useRef()

  async function handleExportBackup() {
    const [transactions, cats, subcats] = await Promise.all([
      db.transactions.toArray(),
      db.categories.toArray(),
      db.subcategories.toArray(),
    ])
    const payload = { version: 1, exportedAt: new Date().toISOString(), transactions, categories: cats, subcategories: subcats }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cuadra-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportBackup(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBackupStatus('restoring')
    try {
      const text = await file.text()
      const payload = JSON.parse(text)
      if (!payload.version || !payload.transactions || !payload.categories) throw new Error('Formato de backup no válido')
      await db.transaction('rw', db.transactions, db.categories, db.subcategories, async () => {
        await db.transactions.clear()
        await db.categories.clear()
        await db.subcategories.clear()
        if (payload.transactions.length)  await db.transactions.bulkPut(payload.transactions)
        if (payload.categories.length)    await db.categories.bulkPut(payload.categories)
        if (payload.subcategories?.length) await db.subcategories.bulkPut(payload.subcategories)
      })
      // Reload all stores from DB
      await Promise.all([
        useTransactionStore.getState().loadFromDB(),
        useCategoryStore.getState().loadFromDB(),
        useSubcategoryStore.getState().loadFromDB(),
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
    const categorized = autoCategorize(rows, categories)
    setMappedRows(categorized)
    setStep('preview')
  }

  const handleImport = async () => {
    const added = await addTransactions(mappedRows)
    setImportedCount(added)
    setSkippedCount(mappedRows.length - added)
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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Importar movimientos</h1>
          <p className="text-slate-500 text-sm mt-1">Importa un extracto bancario en formato CSV o Excel</p>
        </div>
        {totalTransactions > 0 && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-sm text-red-600">¿Eliminar {totalTransactions} movimientos?</span>
                <button
                  onClick={async () => { await clearAll(); setConfirmClear(false) }}
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
            onClick={handleExportBackup}
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
          {backupStatus === 'restoring' && <span className="text-xs text-slate-400 animate-pulse">Restaurando…</span>}
          {backupStatus === 'ok'        && <span className="text-xs text-emerald-600 font-medium">✓ Backup restaurado correctamente</span>}
          {backupStatus === 'error'     && <span className="text-xs text-red-600 font-medium">✗ Error al restaurar — comprueba que el fichero es un backup válido</span>}
        </div>
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
              <span className={isActive ? 'text-indigo-600 font-medium' : 'text-slate-400'}>{labels[i]}</span>
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
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
            isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50'
          }`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileRef.current?.click()}
        >
          <div className="text-4xl mb-3">📂</div>
          <p className="text-slate-700 font-medium">Arrastra tu archivo aquí</p>
          <p className="text-slate-400 text-sm mt-1">o haz clic para seleccionarlo</p>
          <p className="text-slate-400 text-xs mt-3">Formatos soportados: CSV, XLSX, XLS</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
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
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  value={mapping[field]}
                  onChange={(e) => handleMapping(field, e.target.value)}
                >
                  <option value="">— No mapear —</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">Vista previa</h2>
          <p className="text-sm text-slate-500 mb-5">
            {mappedRows.length} movimientos listos para importar. Se aplicó categorización automática.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-80 overflow-y-auto">
            <table className="text-sm w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Descripción</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Importe</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Categoría</th>
                </tr>
              </thead>
              <tbody>
                {mappedRows.map((row, i) => {
                  const cat = categories.find((c) => c.id === row.categoria)
                  return (
                    <tr key={i} className="border-t border-slate-100">
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              Atrás
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
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
