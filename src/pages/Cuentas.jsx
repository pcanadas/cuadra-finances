import { useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import useTransactionStore from '../store/useTransactionStore'
import useAccountStore from '../store/useAccountStore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { isMobile } from '../platform'
import { checkBalances, findDuplicates } from '../utils/bankBalance'
import { createBackup } from '../utils/backupManager'

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatEur(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

function useTooltipStyle() {
  const { dark } = useTheme()
  return dark
    ? { backgroundColor: '#262626', border: '1px solid #525252', color: '#f5f5f5' }
    : { backgroundColor: '#fff',    border: '1px solid #e2e8f0', color: '#1e293b' }
}

// ─── custom tooltip ───────────────────────────────────────────────────────────

function BalanceTooltip({ active, payload, tooltipStyle }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ ...tooltipStyle, borderRadius: 10, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{d.label}</p>
      <p>Saldo: <strong>{formatEur(d.saldo)}</strong></p>
      {d.importe != null && (
        <p style={{ color: d.importe >= 0 ? '#16a34a' : '#dc2626' }}>
          Movimiento: {formatEur(d.importe)}
        </p>
      )}
      {d.descripcion && (
        <p style={{ opacity: 0.7, maxWidth: 220, whiteSpace: 'normal', marginTop: 2 }}>{d.descripcion}</p>
      )}
    </div>
  )
}

// ─── verificación de coherencia ──────────────────────────────────────────────

function EditGapModal({ tx, onSave, onClose }) {
  const [fechaContable, setFechaContable] = useState(tx.fechaContable ?? '')
  const [fechaValor,    setFechaValor]    = useState(tx.fechaValor    ?? '')
  const [descripcion,   setDescripcion]   = useState(tx.descripcion   ?? '')

  async function handleSave() {
    await onSave({ fechaContable, fechaValor, descripcion })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
        <h3 className="text-base font-semibold text-slate-800 mb-4">Editar movimiento</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha contable</label>
            <input type="date" value={fechaContable} onChange={(e) => setFechaContable(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha valor</label>
            <input type="date" value={fechaValor} onChange={(e) => setFechaValor(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
            <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-500 space-y-1">
            <div>Importe: <span className={tx.importe >= 0 ? 'text-green-600' : 'text-red-500'}>{formatEur(tx.importe)}</span></div>
            <div>Saldo: <span className="font-medium text-slate-700">{formatEur(tx.saldo)}</span></div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancelar</button>
          <button onClick={handleSave} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">Guardar</button>
        </div>
      </div>
    </div>
  )
}

const thClass = 'px-4 py-2 font-semibold text-slate-500'
const rowClass = 'border-b border-slate-100 last:border-b-0 transition-colors hover:bg-slate-100'

function Section({ tone, icon, title, children, aside }) {
  const tones = {
    amber: { box: 'border-amber-200', header: 'bg-amber-50 text-amber-700' },
    rose: { box: 'border-rose-200', header: 'bg-rose-50 text-rose-700' },
  }
  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${tones[tone].box}`}>
      <header className={`px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap ${tones[tone].header}`}>
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-semibold">{title}</span>
        {aside && <span className="ml-auto">{aside}</span>}
      </header>
      {children}
    </div>
  )
}

// Mismo movimiento importado dos veces (extractos que se solapan): se propone borrar las copias de más
function DuplicatesSection({ groups, onDelete }) {
  const copies = groups.flatMap((g) => g.remove)
  const [selected, setSelected] = useState(() => new Set(copies.map((t) => t.id)))
  const [busy, setBusy] = useState(false)
  const chosen = copies.filter((t) => selected.has(t.id))
  const total = chosen.reduce((s, t) => s + t.importe, 0)

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function remove() {
    if (!chosen.length) return
    if (!window.confirm(`Se borrarán ${chosen.length} movimiento${chosen.length !== 1 ? 's' : ''} duplicado${chosen.length !== 1 ? 's' : ''}. Antes se guarda una copia de seguridad (Importar → Historial de backups).`)) return
    setBusy(true)
    try { await onDelete(chosen.map((t) => t.id)) } finally { setBusy(false) }
  }

  return (
    <Section tone="rose" icon="⧉"
      title={`${copies.length} movimiento${copies.length !== 1 ? 's' : ''} importado${copies.length !== 1 ? 's' : ''} dos veces`}>
      <p className="px-4 pt-3 text-xs text-slate-500">
        Vienen en dos extractos que se solapan y se importaron otra vez (versiones anteriores de la app).
        Cuentan doble en los totales. Se conserva la copia del extracto más reciente.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs mt-2">
          <thead className="bg-slate-50 border-y border-slate-100">
            <tr>
              <th className={`${thClass} w-8`} />
              <th className={`${thClass} text-left`}>Fecha</th>
              <th className={`${thClass} text-left`}>Descripción</th>
              <th className={`${thClass} text-right`}>Importe</th>
              <th className={`${thClass} text-right`}>Saldo de la copia</th>
            </tr>
          </thead>
          <tbody>
            {copies.map((t) => (
              <tr key={t.id} className={`${rowClass} cursor-pointer`} onClick={() => toggle(t.id)}>
                <td className="px-4 py-2"><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} onClick={(e) => e.stopPropagation()} /></td>
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{format(new Date(t.fechaContable), 'dd/MM/yyyy')}</td>
                <td className="px-4 py-2 text-slate-700 max-w-xs truncate" title={t.descripcion}>{t.descripcion || '—'}</td>
                <td className={`px-4 py-2 text-right whitespace-nowrap font-medium ${t.importe >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatEur(t.importe)}</td>
                <td className="px-4 py-2 text-right text-slate-500 whitespace-nowrap">{t.saldo != null ? formatEur(t.saldo) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-3 flex-wrap">
        <span className="text-xs text-slate-500">Seleccionados: {chosen.length} · {formatEur(total)}</span>
        <button onClick={remove} disabled={busy || !chosen.length}
          className="ml-auto px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40">
          {busy ? 'Borrando…' : `Borrar ${chosen.length} duplicado${chosen.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </Section>
  )
}

function IssuesTable({ rows, isAcknowledged, onAcknowledge, onUnacknowledge, onEdit }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className={`${thClass} text-left`}>Fecha</th>
            <th className={`${thClass} text-left`}>Descripción</th>
            <th className={`${thClass} text-right`}>Importe</th>
            <th className={`${thClass} text-right`}>Saldo</th>
            <th className={`${thClass} text-right`} title="Saldo que debería tener el movimiento anterior">Saldo anterior esperado</th>
            <th className={`${thClass} text-left`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className={`${rowClass} ${isAcknowledged ? 'opacity-50' : ''}`}>
              <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{format(new Date(t.fechaContable), 'dd/MM/yyyy')}</td>
              <td className="px-4 py-2 text-slate-700 max-w-xs truncate" title={t.descripcion}>{t.descripcion || '—'}</td>
              <td className={`px-4 py-2 text-right whitespace-nowrap font-medium ${t.importe >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatEur(t.importe)}</td>
              <td className="px-4 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">{formatEur(t.saldo)}</td>
              <td className="px-4 py-2 text-right text-slate-500 whitespace-nowrap">{formatEur(Math.round((t.saldo - t.importe) * 100) / 100)}</td>
              <td className="px-4 py-2 whitespace-nowrap">
                <div className="flex gap-1 items-center">
                  <button onClick={() => onEdit(t)}
                    className="text-xs text-indigo-600 hover:text-indigo-700 transition-colors px-2 py-1 rounded border border-indigo-200 hover:bg-slate-100">Editar</button>
                  {isAcknowledged ? (
                    <button onClick={() => onUnacknowledge(t.id)} title="Marcar como pendiente"
                      className="text-xs text-slate-500 hover:text-slate-700 transition-colors px-2 py-1 rounded">Reabrir</button>
                  ) : (
                    <button onClick={() => onAcknowledge(t.id)} title="Marcar como revisada: sé que falta este tramo y no voy a importarlo"
                      className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors px-2 py-1 rounded border border-green-200 hover:bg-slate-100">Revisada ✓</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BalancePanel({ check, duplicates, acknowledgedIds, onAcknowledge, onUnacknowledge, onEditTx, onDeleteDuplicates }) {
  const [showAcknowledged, setShowAcknowledged] = useState(false)
  const [editing, setEditing] = useState(null)
  const ack = new Set(acknowledgedIds ?? [])
  const pending = check.issues.filter((t) => !ack.has(t.id))
  const acknowledged = check.issues.filter((t) => ack.has(t.id))
  // Las copias se identifican por sus ids: si cambian (tras borrar o importar), el panel empieza de cero
  const duplicatesKey = duplicates.flatMap((g) => g.remove.map((t) => t.id)).join(',')

  return (
    <div className="space-y-3">
      {duplicates.length > 0 && <DuplicatesSection key={duplicatesKey} groups={duplicates} onDelete={onDeleteDuplicates} />}

      {pending.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <span className="text-lg">✓</span>
          Todos los movimientos cuadran con el saldo del banco.
          {acknowledged.length > 0 && (
            <button onClick={() => setShowAcknowledged((v) => !v)} className="ml-auto text-xs underline">
              {showAcknowledged ? 'Ocultar' : 'Ver'} {acknowledged.length} revisada{acknowledged.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      ) : (
        <Section tone="amber" icon="⚠"
          title={`${pending.length} movimiento${pending.length !== 1 ? 's' : ''} no cuadra${pending.length !== 1 ? 'n' : ''} con el saldo anterior`}
          aside={acknowledged.length > 0 && (
            <button onClick={() => setShowAcknowledged((v) => !v)} className="text-xs text-slate-500 underline hover:text-slate-700">
              {showAcknowledged ? 'Ocultar' : 'Ver'} {acknowledged.length} revisada{acknowledged.length !== 1 ? 's' : ''}
            </button>
          )}>
          <p className="px-4 pt-3 pb-2 text-xs text-slate-500">
            Ningún movimiento de la cuenta deja el saldo que estos esperan antes de ellos: suele faltar un tramo del extracto
            justo antes (impórtalo) o se ha cambiado algún dato. Marca como revisados los tramos que no vayas a importar.
          </p>
          <IssuesTable rows={pending} isAcknowledged={false} onAcknowledge={onAcknowledge} onUnacknowledge={onUnacknowledge} onEdit={setEditing} />
        </Section>
      )}

      {showAcknowledged && acknowledged.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500 font-medium">Revisadas</div>
          <IssuesTable rows={acknowledged} isAcknowledged onAcknowledge={onAcknowledge} onUnacknowledge={onUnacknowledge} onEdit={setEditing} />
        </div>
      )}

      {check.pending.length > 0 && (
        <p className="px-1 text-xs text-slate-500">
          ⏳ {check.pending.length} movimiento{check.pending.length !== 1 ? 's' : ''} pendiente{check.pending.length !== 1 ? 's' : ''} del banco, aún sin saldo:
          se completará{check.pending.length !== 1 ? 'n' : ''} al importar el siguiente extracto.
        </p>
      )}

      {editing && (
        <EditGapModal tx={editing} onSave={(updates) => onEditTx(editing.id, updates)} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Cuentas() {
  const transactions = useTransactionStore((s) => s.transactions)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const deleteTransactions = useTransactionStore((s) => s.deleteTransactions)
  const { accounts, updateAccount } = useAccountStore()
  const tooltipStyle = useTooltipStyle()
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? null)

  const defaultAccountId = accounts[0]?.id ?? null

  // Movimientos de la cuenta elegida. Los antiguos sin accountId son de la primera cuenta.
  const allAccountTxs = useMemo(() => {
    return transactions.filter((t) => (t.accountId ?? defaultAccountId) === selectedAccountId)
  }, [transactions, selectedAccountId, defaultAccountId])

  // Coherencia con el saldo del banco y duplicados entre extractos
  const check = useMemo(() => checkBalances(allAccountTxs), [allAccountTxs])
  const duplicates = useMemo(() => findDuplicates(allAccountTxs), [allAccountTxs])

  // Date-sorted transactions (for chart and stats — preserves chronological order)
  const allAccountTxsDateSorted = useMemo(() => {
    return [...allAccountTxs].sort((a, b) => {
      const d = new Date(a.fechaContable) - new Date(b.fechaContable)
      return d !== 0 ? d : (a.id < b.id ? -1 : 1)
    })
  }, [allAccountTxs])

  // Movimientos con saldo del banco (sin pendientes) — orden de fecha para gráfico y estadísticas
  const accountTxsDateSorted = useMemo(() => {
    const valid = new Set(check.withBalance)
    return allAccountTxsDateSorted.filter((t) => valid.has(t))
  }, [allAccountTxsDateSorted, check])

  // Synthetic mode: no real saldo but there are manual transactions
  const isSynthetic = accountTxsDateSorted.length === 0 && allAccountTxsDateSorted.length > 0
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const saldoInicial = selectedAccount?.saldoInicial ?? 0

  // Synthetic transactions with calculated running balance
  const syntheticTxs = useMemo(() => {
    if (!isSynthetic) return []
    let running = saldoInicial
    return allAccountTxsDateSorted.map((t) => {
      running = Math.round((running + (t.importe ?? 0)) * 100) / 100
      return { ...t, saldoCalculado: running }
    })
  }, [allAccountTxsDateSorted, isSynthetic, saldoInicial])

  // Chart data — monthly, uses first transaction of each month (opening balance)
  const chartData = useMemo(() => {
    const source = isSynthetic ? syntheticTxs : accountTxsDateSorted
    const saldoKey = isSynthetic ? 'saldoCalculado' : 'saldo'
    const byMonth = {}
    source.forEach((t) => {
      const key = t.fechaContable?.slice(0, 7)
      if (!key) return
      // Keep only the first transaction per month (opening balance of the month)
      if (!(key in byMonth)) byMonth[key] = t[saldoKey]
    })
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, saldo]) => ({
        label: format(new Date(month + '-02'), 'MMM yyyy', { locale: es }),
        saldo,
      }))
  }, [accountTxsDateSorted, syntheticTxs, isSynthetic])

  // Stats
  const stats = useMemo(() => {
    if (isSynthetic) {
      if (syntheticTxs.length === 0) return null
      const first = syntheticTxs[0]
      const last  = syntheticTxs[syntheticTxs.length - 1]
      return {
        firstDate:  format(new Date(first.fechaContable), 'dd/MM/yyyy'),
        lastDate:   format(new Date(last.fechaContable),  'dd/MM/yyyy'),
        firstSaldo: saldoInicial,
        lastSaldo:  last.saldoCalculado,
        change:     Math.round((last.saldoCalculado - saldoInicial) * 100) / 100,
        txCount:    allAccountTxsDateSorted.length,
        withSaldo:  allAccountTxsDateSorted.length,
      }
    }
    if (accountTxsDateSorted.length === 0) return null
    const first = accountTxsDateSorted[0]
    const last  = accountTxsDateSorted[accountTxsDateSorted.length - 1]
    return {
      firstDate:  format(new Date(first.fechaContable), 'dd/MM/yyyy'),
      lastDate:   format(new Date(last.fechaContable),  'dd/MM/yyyy'),
      firstSaldo: first.saldo,
      lastSaldo:  last.saldo,
      change:     last.saldo - first.saldo,
      txCount:    allAccountTxsDateSorted.length,
      withSaldo:  accountTxsDateSorted.length,
    }
  }, [accountTxsDateSorted, syntheticTxs, isSynthetic, saldoInicial, allAccountTxsDateSorted])

  const yMin = useMemo(() => {
    if (!chartData.length) return 'auto'
    const min = Math.min(...chartData.map((d) => d.saldo))
    return min >= 0 ? 0 : Math.floor(min * 1.05)
  }, [chartData])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Evolución del saldo</h1>
        <p className="text-slate-500 text-sm mt-1">
          Saldo real de cada cuenta a lo largo del tiempo, según los extractos importados.
          Se comprueba que cada movimiento cuadra con el saldo del banco.
        </p>
      </div>

      {/* Account tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedAccountId(a.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              selectedAccountId === a.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
            {a.nombre}
          </button>
        ))}
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No hay cuentas configuradas. Ve a {isMobile ? 'Registros' : 'Movimientos'} → Cuentas para añadir una.
        </div>
      ) : !selectedAccount ? null : allAccountTxs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <p className="font-medium">No hay movimientos para "{selectedAccount.nombre}"</p>
          <p className="text-xs mt-2">Importa un extracto o añade movimientos manuales en la sección {isMobile ? 'Registros' : 'Movimientos'}.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Synthetic mode notice + initial balance */}
          {isSynthetic && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4">
              <div className="flex-1 text-sm text-blue-700">
                <span className="font-semibold">Saldo calculado</span> — esta cuenta no tiene extractos importados.
                El gráfico se calcula acumulando los movimientos manuales desde el saldo inicial que indiques.
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs font-medium text-blue-600 whitespace-nowrap">Saldo inicial (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={saldoInicial}
                  onChange={(e) => updateAccount(selectedAccountId, { saldoInicial: parseFloat(e.target.value) || 0 })}
                  className="w-28 border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
          )}
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Saldo actual', value: formatEur(stats.lastSaldo), sub: `a ${stats.lastDate}`, bold: true, color: stats.lastSaldo >= 0 ? 'text-green-600' : 'text-red-600' },
              { label: 'Saldo inicial', value: formatEur(stats.firstSaldo), sub: `desde ${stats.firstDate}` },
              { label: 'Variación total', value: (stats.change >= 0 ? '+' : '') + formatEur(stats.change), sub: 'en el período', color: stats.change >= 0 ? 'text-green-600' : 'text-red-600' },
              { label: 'Movimientos', value: stats.txCount.toLocaleString('es-ES'), sub: `${stats.withSaldo} con saldo` },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{s.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${s.color ?? 'text-slate-800'}`}>{s.value}</p>
                {s.sub && <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              Saldo de "{selectedAccount.nombre}"
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  tickLine={false}
                />
                <YAxis
                  domain={[yMin, 'auto']}
                  tickFormatter={(v) => new Intl.NumberFormat('es-ES', { notation: 'compact', currency: 'EUR', style: 'currency' }).format(v)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  content={(props) => <BalanceTooltip {...props} tooltipStyle={tooltipStyle} />}
                />
                {yMin < 0 && <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5} />}
                <Line
                  type="monotone"
                  dataKey="saldo"
                  stroke={selectedAccount.color}
                  strokeWidth={2}
                  dot={chartData.length <= 60}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Consistency check */}
          {!isSynthetic && (
            <div>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Verificación de coherencia</h2>
              <BalancePanel
                check={check}
                duplicates={duplicates}
                acknowledgedIds={selectedAccount?.acknowledgedGaps}
                onAcknowledge={(id) => {
                  const current = selectedAccount?.acknowledgedGaps ?? []
                  updateAccount(selectedAccountId, { acknowledgedGaps: [...current, id] })
                }}
                onUnacknowledge={(id) => {
                  const current = selectedAccount?.acknowledgedGaps ?? []
                  updateAccount(selectedAccountId, { acknowledgedGaps: current.filter((k) => k !== id) })
                }}
                onEditTx={(id, updates) => updateTransaction(id, updates)}
                onDeleteDuplicates={async (ids) => {
                  await createBackup('auto: antes de borrar duplicados')
                  await deleteTransactions(ids)
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
