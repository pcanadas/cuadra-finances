import { useMemo, useState } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useSubcategoryStore from '../store/useSubcategoryStore'
import useAccountStore from '../store/useAccountStore'
import { useBackHandler } from '../platform/back'
import { isMobile } from '../platform'
import { getCategoryIcon } from '../utils/categoryIcons'

const LAST_ACCOUNT_KEY = 'cuadra.quickAdd.lastAccount'

const TIPOS = [
  { id: 'gasto', label: 'Gasto', active: 'bg-rose-500 text-white' },
  { id: 'ingreso', label: 'Ingreso', active: 'bg-emerald-600 text-white' },
  { id: 'transferencia', label: 'Transferencia', active: 'bg-indigo-600 text-white' },
]

function isoDate(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function readLastAccount() {
  try { return localStorage.getItem(LAST_ACCOUNT_KEY) } catch { return null }
}

function saveLastAccount(id) {
  try { localStorage.setItem(LAST_ACCOUNT_KEY, id) } catch { /* sin almacenamiento */ }
}

// ─── Chips de cuenta ────────────────────────────────────────────────────────

function AccountChips({ accounts, value, onChange, exclude }) {
  return (
    <div className="flex flex-wrap gap-2">
      {accounts.filter((a) => a.id !== exclude).map((a) => {
        const active = a.id === value
        return (
          <button key={a.id} type="button" onClick={() => onChange(a.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm ${
              active ? 'border-transparent font-semibold' : 'border-slate-200 text-slate-600 bg-white'
            }`}
            style={active ? { backgroundColor: a.color + '26', color: a.color, borderColor: a.color } : undefined}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
            {a.nombre}
          </button>
        )
      })}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h3>
      {children}
    </section>
  )
}

// ─── Alta rápida (pantalla completa en móvil, ventana en escritorio) ────────

export default function QuickAdd({ initialTipo = 'gasto', onClose, onSaved }) {
  const addManualTransaction = useTransactionStore((s) => s.addManualTransaction)
  const categories = useCategoryStore((s) => s.categories)
  const subcategories = useSubcategoryStore((s) => s.subcategories)
  const accounts = useAccountStore((s) => s.accounts)

  useBackHandler(true, onClose)

  const [today] = useState(() => new Date())
  const yesterday = new Date(today.getTime() - 86400000)

  const defaultAccount = (() => {
    const last = readLastAccount()
    return accounts.some((a) => a.id === last) ? last : accounts[0]?.id ?? ''
  })()

  const [tipo, setTipo] = useState(initialTipo)
  const [categoria, setCategoria] = useState(null)
  const [subcategoria, setSubcategoria] = useState(null)
  const [importe, setImporte] = useState('')
  const [fecha, setFecha] = useState(isoDate(today))
  const [nota, setNota] = useState('')
  const [accountId, setAccountId] = useState(defaultAccount)
  const [destinoId, setDestinoId] = useState(accounts.find((a) => a.id !== defaultAccount)?.id ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const tipoCategories = useMemo(() => categories
    .filter((c) => !c.esTransferencia && (tipo === 'ingreso' ? c.esIngreso : !c.esIngreso))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [categories, tipo])
  const subs = categoria ? subcategories.filter((s) => s.categoriaId === categoria) : []
  const transferCat = categories.find((c) => c.esTransferencia)

  function changeTipo(t) {
    setTipo(t)
    setCategoria(null)
    setSubcategoria(null)
    setError('')
  }

  async function handleSave() {
    const amount = Math.abs(parseFloat(String(importe).replace(',', '.')))
    if (!amount) return setError('Introduce un importe')
    if (!accountId) return setError('Elige una cuenta')
    if (tipo === 'transferencia' && (!destinoId || destinoId === accountId)) return setError('Elige una cuenta destino distinta')

    setSaving(true)
    const notas = nota.trim()
    const before = new Set(useTransactionStore.getState().transactions.map((t) => t.id))

    if (tipo === 'transferencia') {
      const origen = accounts.find((a) => a.id === accountId)
      const destino = accounts.find((a) => a.id === destinoId)
      const pairId = `tp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const base = { fechaContable: fecha, categoria: transferCat?.id ?? null, categoriaManual: true, transferPairId: pairId, notas }
      await addManualTransaction({ ...base, descripcion: notas || `Traspaso a ${destino?.nombre}`, importe: -amount, accountId })
      await addManualTransaction({ ...base, descripcion: notas || `Traspaso desde ${origen?.nombre}`, importe: amount, accountId: destinoId, esContrapartida: true })
    } else {
      const cat = categories.find((c) => c.id === categoria)
      await addManualTransaction({
        fechaContable: fecha,
        descripcion: notas || cat?.nombre || (tipo === 'ingreso' ? 'Ingreso' : 'Gasto'),
        importe: tipo === 'gasto' ? -amount : amount,
        categoria: categoria || null,
        categoriaManual: !!categoria,
        subcategoria: subcategoria || null,
        subcategoriaManual: !!subcategoria,
        accountId,
        notas,
      })
    }

    saveLastAccount(accountId)
    navigator.vibrate?.(20)
    const created = useTransactionStore.getState().transactions.filter((t) => !before.has(t.id)).map((t) => t.id)
    onSaved?.({ tipo, ids: created })
  }

  const fechaChip = (label, value) => (
    <button type="button" onClick={() => setFecha(value)}
      className={`px-4 py-2 rounded-full border text-sm ${fecha === value ? 'bg-indigo-600 text-white border-indigo-600 font-semibold' : 'bg-white border-slate-200 text-slate-600'}`}>
      {label}
    </button>
  )
  const saveOnEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave() } }
  const isOtherDay = fecha !== isoDate(today) && fecha !== isoDate(yesterday)
  const tipoActual = TIPOS.find((t) => t.id === tipo)

  return (
    <div className="fixed inset-0 z-[70] flex lg:items-center lg:justify-center lg:bg-black/40 lg:p-6" onClick={onClose}>
    <div className="flex-1 lg:flex-none w-full lg:max-w-lg h-full lg:h-auto lg:max-h-full bg-slate-50 flex flex-col lg:rounded-2xl lg:shadow-xl lg:overflow-hidden"
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
      onClick={(e) => e.stopPropagation()}>
      {/* Barra superior */}
      <div className="flex items-center gap-2 px-2 h-12 bg-white border-b border-slate-200">
        <button onClick={onClose} className="w-10 h-10 text-2xl text-slate-500 hover:text-slate-700" aria-label="Cerrar" title="Cerrar (Esc)">✕</button>
        <h2 className="text-base font-semibold text-slate-800">Nuevo movimiento</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
        {/* Tipo */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-200/60 rounded-xl">
          {TIPOS.map((t) => (
            <button key={t.id} type="button" onClick={() => changeTipo(t.id)}
              className={`py-2.5 rounded-lg text-sm font-semibold ${tipo === t.id ? t.active : 'text-slate-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Categoría */}
        {tipo !== 'transferencia' && (
          <Section title="Categoría">
            <div className="grid grid-cols-4 gap-2">
              {tipoCategories.map((c) => {
                const active = c.id === categoria
                return (
                  <button key={c.id} type="button"
                    onClick={() => { setCategoria(active ? null : c.id); setSubcategoria(null) }}
                    className={`flex flex-col items-center gap-1 py-2 rounded-xl border ${active ? 'bg-white shadow-sm' : 'border-transparent hover:bg-slate-100'}`}
                    style={active ? { borderColor: c.color } : undefined}>
                    <span className="w-11 h-11 rounded-full flex items-center justify-center text-2xl"
                      style={{ backgroundColor: c.color + '26' }}>
                      {getCategoryIcon(c)}
                    </span>
                    <span className="text-[11px] leading-tight text-slate-600 text-center line-clamp-2 px-0.5">{c.nombre}</span>
                  </button>
                )
              })}
            </div>
            {subs.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {subs.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSubcategoria(subcategoria === s.id ? null : s.id)}
                    className={`px-3 py-1.5 rounded-full border text-sm ${subcategoria === s.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600'}`}>
                    {s.nombre}
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* Importe */}
        <Section title="Importe">
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 focus-within:ring-2 focus-within:ring-indigo-300">
            <input type="text" inputMode="decimal" placeholder="0,00" value={importe} autoFocus={!isMobile}
              onChange={(e) => { setImporte(e.target.value.replace(/[^0-9.,]/g, '')); setError('') }}
              onKeyDown={saveOnEnter}
              className="flex-1 min-w-0 py-3 text-3xl font-bold text-slate-800 bg-transparent focus:outline-none" />
            <span className="text-2xl font-semibold text-slate-400">€</span>
          </div>
        </Section>

        {/* Día */}
        <Section title="Día">
          <div className="flex flex-wrap items-center gap-2">
            {fechaChip('Hoy', isoDate(today))}
            {fechaChip('Ayer', isoDate(yesterday))}
            <label className={`relative px-4 py-2 rounded-full border text-sm ${isOtherDay ? 'bg-indigo-600 text-white border-indigo-600 font-semibold' : 'bg-white border-slate-200 text-slate-600'}`}>
              📅 {isOtherDay ? new Date(fecha + 'T00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'Otro'}
              <input type="date" value={fecha} max={isoDate(today)}
                onChange={(e) => e.target.value && setFecha(e.target.value)}
                className="absolute inset-0 opacity-0" />
            </label>
          </div>
        </Section>

        {/* Nota */}
        <Section title="Nota">
          <input type="text" placeholder="Opcional" value={nota} onChange={(e) => setNota(e.target.value)} onKeyDown={saveOnEnter}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </Section>

        {/* Cuenta(s) */}
        <Section title={tipo === 'transferencia' ? 'Desde' : 'Cuenta'}>
          <AccountChips accounts={accounts} value={accountId}
            onChange={(id) => { setAccountId(id); if (id === destinoId) setDestinoId(accounts.find((a) => a.id !== id)?.id ?? '') }} />
        </Section>
        {tipo === 'transferencia' && (
          <Section title="Hacia">
            {accounts.length < 2
              ? <p className="text-sm text-slate-400">Necesitas al menos dos cuentas ({isMobile ? 'Registros' : 'Movimientos'} → Cuentas).</p>
              : <AccountChips accounts={accounts} value={destinoId} onChange={setDestinoId} exclude={accountId} />}
          </Section>
        )}
      </div>

      {/* Guardar */}
      <div className="px-4 py-3 bg-white border-t border-slate-200">
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <button onClick={handleSave} disabled={saving}
          className={`w-full py-3.5 rounded-xl text-base font-semibold disabled:opacity-60 ${tipoActual.active}`}>
          Guardar {tipoActual.label.toLowerCase()}
        </button>
      </div>
    </div>
    </div>
  )
}
