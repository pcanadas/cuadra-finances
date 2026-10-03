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

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatEur(v) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
}

function useTooltipStyle() {
  const { dark } = useTheme()
  return dark
    ? { backgroundColor: '#233d4c', border: '1px solid #3a6070', color: '#e8f4f8' }
    : { backgroundColor: '#fff',    border: '1px solid #e2e8f0', color: '#1e293b' }
}

const TOLERANCE = 0.02   // cents rounding from bank PDFs

// Reorders transactions by chaining saldos globally across all dates:
// saldo[i-1] + importe[i] ≈ saldo[i]
//
// Bankinter interleaves transactions with different fechaContable within the same
// export block (e.g. a 31/01 transfer appears after 01/02 payments). Sorting by
// date breaks the saldo chain. This function reconstructs the bank's original
// order using the saldo values as a linked list, regardless of date.
//
// Complexity: O(n) — uses a predecessor-saldo map for O(1) lookups.
function chainGlobal(txs) {
  const withSaldo    = txs.filter((t) => t.saldo != null && t.importe != null)
  const withoutSaldo = txs.filter((t) => t.saldo == null || t.importe == null)

  if (withSaldo.length <= 1) return txs

  // Map: Math.round(predecessorSaldo * 100) → [candidates]
  // predecessorSaldo of t = t.saldo - t.importe  (the balance just before t)
  const predMap = new Map()
  withSaldo.forEach((t) => {
    const key = Math.round((t.saldo - t.importe) * 100)
    if (!predMap.has(key)) predMap.set(key, [])
    predMap.get(key).push(t)
  })

  // Chain starts: transactions whose predecessor saldo doesn't match any tx's saldo
  const saldoSet = new Set(withSaldo.map((t) => Math.round(t.saldo * 100)))
  const starts = withSaldo.filter((t) => !saldoSet.has(Math.round((t.saldo - t.importe) * 100)))

  const visited = new Set()
  const chains = []

  function walkChain(startTx) {
    const chain = []
    let cur = startTx
    while (cur && !visited.has(cur)) {
      visited.add(cur)
      chain.push(cur)
      const candidates = predMap.get(Math.round(cur.saldo * 100)) ?? []
      const unvisited = candidates.filter((t) => !visited.has(t))
      // When multiple candidates match (same importe/saldo), prefer the one
      // whose bankRowIndex comes right after the current one in the original
      // bank export order.
      unvisited.sort((a, b) => {
        const aIdx = a.bankRowIndex ?? Infinity
        const bIdx = b.bankRowIndex ?? Infinity
        return aIdx - bIdx
      })
      cur = unvisited[0] ?? null
    }
    if (chain.length > 0) chains.push(chain)
  }

  starts.forEach(walkChain)

  // Handle any unvisited transactions (isolated chains from separate import batches)
  withSaldo.forEach((t) => { if (!visited.has(t)) walkChain(t) })

  // Sort chains chronologically by their earliest fechaContable so that
  // inter-chain gaps always represent forward jumps in time, not backward ones.
  chains.sort((a, b) => {
    const dateA = a[0]?.fechaContable ?? ''
    const dateB = b[0]?.fechaContable ?? ''
    const d = dateA.localeCompare(dateB)
    if (d !== 0) return d
    // Tiebreak: chain whose first tx appeared earlier in the bank export
    const idxA = a[0]?.bankRowIndex ?? Infinity
    const idxB = b[0]?.bankRowIndex ?? Infinity
    return idxA - idxB
  })

  const ordered = chains.flat()

  // Transactions without saldo (manual) go at the end — they're not part of the chain
  ordered.push(...withoutSaldo)
  return ordered
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

// ─── consistency checker ──────────────────────────────────────────────────────

// Fingerprint that uniquely identifies a gap
function gapKey(g) {
  return `${g.prevDate}|${g.currDate}|${g.prevSaldo}|${g.diff}`
}

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

function ConsistencyPanel({ gaps, acknowledgedGaps, onAcknowledge, onUnacknowledge, onEditTx }) {
  const [showAcknowledged, setShowAcknowledged] = useState(false)
  const [editingGap, setEditingGap] = useState(null)
  const acknowledgedSet = new Set(acknowledgedGaps ?? [])

  const pending      = gaps.filter((g) => !acknowledgedSet.has(gapKey(g)))
  const acknowledged = gaps.filter((g) =>  acknowledgedSet.has(gapKey(g)))

  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
        <span className="text-lg">✓</span>
        Todos los saldos concuerdan con los importes. Los datos parecen completos.
      </div>
    )
  }

  function GapTable({ rows, isAcknowledged }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-500">Fecha anterior</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-500">Fecha actual</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-500">Descripción</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Saldo anterior</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">+ Importe</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Esperado</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Saldo real</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Diferencia</th>
              <th className="px-4 py-2 text-left font-semibold text-slate-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g, i) => (
              <tr key={i} className={`border-b border-slate-50 last:border-b-0 transition-colors ${isAcknowledged ? 'opacity-50' : 'hover:bg-amber-50'}`}>
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{g.prevDate}</td>
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{g.currDate}</td>
                <td className="px-4 py-2 text-slate-700 max-w-xs truncate" title={g.descripcion}>{g.descripcion || '—'}</td>
                <td className="px-4 py-2 text-right text-slate-600 whitespace-nowrap">{formatEur(g.prevSaldo)}</td>
                <td className={`px-4 py-2 text-right whitespace-nowrap font-medium ${g.importe >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatEur(g.importe)}</td>
                <td className="px-4 py-2 text-right text-slate-400 whitespace-nowrap">{formatEur(g.expected)}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">{formatEur(g.actual)}</td>
                <td className="px-4 py-2 text-right font-semibold text-amber-600 whitespace-nowrap">{formatEur(g.diff)}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="flex gap-1 items-center">
                    {g.currTx && (
                      <button
                        onClick={() => setEditingGap(g)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50"
                        title="Editar el movimiento para corregir la inconsistencia"
                      >Editar</button>
                    )}
                    {isAcknowledged ? (
                      <button
                        onClick={() => onUnacknowledge(gapKey(g))}
                        className="text-xs text-slate-400 hover:text-amber-600 transition-colors px-2 py-1 rounded"
                        title="Marcar como pendiente"
                      >Reabrir</button>
                    ) : (
                      <button
                        onClick={() => onAcknowledge(gapKey(g))}
                        className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors px-2 py-1 rounded border border-green-200 hover:bg-green-50"
                        title="Marcar como revisada — sé que este hueco existe y no necesito importar más datos"
                      >Revisada ✓</button>
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

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 flex-wrap">
        <span className="text-amber-500 text-lg">⚠</span>
        <span className="text-sm font-semibold text-amber-700">
          {pending.length} inconsistencia{pending.length !== 1 ? 's' : ''} pendiente{pending.length !== 1 ? 's' : ''}
        </span>
        {acknowledged.length > 0 && (
          <span className="text-xs text-slate-400 ml-auto">
            {acknowledged.length} revisada{acknowledged.length !== 1 ? 's' : ''} —{' '}
            <button onClick={() => setShowAcknowledged((v) => !v)} className="underline hover:text-slate-600">
              {showAcknowledged ? 'ocultar' : 'mostrar'}
            </button>
          </span>
        )}
      </div>

      {pending.length > 0 && <GapTable rows={pending} isAcknowledged={false} />}

      {showAcknowledged && acknowledged.length > 0 && (
        <>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 font-medium">Revisadas</div>
          <GapTable rows={acknowledged} isAcknowledged={true} />
        </>
      )}

      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
        Usa <strong>Editar</strong> para corregir la fecha u otros datos del movimiento. Usa <strong>Revisada ✓</strong> para archivar huecos conocidos entre extractos.
      </div>

      {editingGap && (
        <EditGapModal
          tx={editingGap.currTx}
          onSave={(updates) => onEditTx(editingGap.currTx.id, updates)}
          onClose={() => setEditingGap(null)}
        />
      )}
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Cuentas() {
  const transactions = useTransactionStore((s) => s.transactions)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const { accounts, updateAccount } = useAccountStore()
  const tooltipStyle = useTooltipStyle()
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? null)

  const defaultAccountId = accounts[0]?.id ?? null

  // All transactions for selected account, ordered by date then chained within each day
  // so that saldo[i-1] + importe[i] ≈ saldo[i] regardless of import direction.
  // Transactions without accountId (imported before multi-account support) are treated
  // as belonging to the first/default account.
  const allAccountTxs = useMemo(() => {
    const filtered = transactions.filter((t) => {
      const effectiveId = t.accountId ?? defaultAccountId
      return effectiveId === selectedAccountId
    })
    return chainGlobal(filtered)
  }, [transactions, selectedAccountId, defaultAccountId])

  // Date-sorted transactions (for chart and stats — preserves chronological order)
  const allAccountTxsDateSorted = useMemo(() => {
    return [...allAccountTxs].sort((a, b) => {
      const d = new Date(a.fechaContable) - new Date(b.fechaContable)
      return d !== 0 ? d : (a.id < b.id ? -1 : 1)
    })
  }, [allAccountTxs])

  // Transactions with real saldo — chained order for consistency checker
  const accountTxs = useMemo(() => {
    return allAccountTxs.filter((t) => t.saldo != null)
  }, [allAccountTxs])

  // Transactions with real saldo — date order for chart and stats
  const accountTxsDateSorted = useMemo(() => {
    return allAccountTxsDateSorted.filter((t) => t.saldo != null)
  }, [allAccountTxsDateSorted])

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
  }, [allAccountTxs, isSynthetic, saldoInicial])

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

  // Consistency gaps (only for real saldo mode)
  const gaps = useMemo(() => {
    if (isSynthetic) return []
    const result = []
    for (let i = 1; i < accountTxs.length; i++) {
      const prev = accountTxs[i - 1]
      const curr = accountTxs[i]
      if (prev.saldo == null || curr.saldo == null || curr.importe == null) continue
      const expected = Math.round((prev.saldo + curr.importe) * 100) / 100
      const diff = Math.round((curr.saldo - expected) * 100) / 100
      if (Math.abs(diff) > TOLERANCE) {
        result.push({
          prevDate: format(new Date(prev.fechaContable), 'dd/MM/yyyy'),
          currDate: format(new Date(curr.fechaContable), 'dd/MM/yyyy'),
          descripcion: curr.descripcion,
          prevSaldo: prev.saldo,
          importe: curr.importe,
          expected,
          actual: curr.saldo,
          diff,
          currTx: curr,
        })
      }
    }
    return result
  }, [accountTxs, isSynthetic])

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
        txCount:    allAccountTxs.length,
        withSaldo:  allAccountTxs.length,
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
          Se verifica automáticamente la coherencia entre saldos e importes.
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
          No hay cuentas configuradas. Ve a Movimientos → Cuentas para añadir una.
        </div>
      ) : !selectedAccount ? null : (accountTxs.length === 0 && allAccountTxs.length === 0) ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <p className="font-medium">No hay movimientos para "{selectedAccount.nombre}"</p>
          <p className="text-xs mt-2">Importa un extracto o añade movimientos manuales en la sección Movimientos.</p>
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
                  interval={Math.max(0, Math.floor(chartData.length / 8) - 1)}
                  tickLine={false}
                />
                <YAxis
                  domain={[yMin, 'auto']}
                  tickFormatter={(v) => new Intl.NumberFormat('es-ES', { notation: 'compact', currency: 'EUR', style: 'currency' }).format(v)}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
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
              <ConsistencyPanel
                gaps={gaps}
                acknowledgedGaps={selectedAccount?.acknowledgedGaps}
                onAcknowledge={(key) => {
                  const current = selectedAccount?.acknowledgedGaps ?? []
                  updateAccount(selectedAccountId, { acknowledgedGaps: [...current, key] })
                }}
                onUnacknowledge={(key) => {
                  const current = selectedAccount?.acknowledgedGaps ?? []
                  updateAccount(selectedAccountId, { acknowledgedGaps: current.filter((k) => k !== key) })
                }}
                onEditTx={(id, updates) => updateTransaction(id, updates)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
