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

function ConsistencyPanel({ gaps }) {
  if (gaps.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
        <span className="text-lg">✓</span>
        Todos los saldos concuerdan con los importes. Los datos parecen completos.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
        <span className="text-amber-500 text-lg">⚠</span>
        <span className="text-sm font-semibold text-amber-700">
          {gaps.length} inconsistencia{gaps.length !== 1 ? 's' : ''} detectada{gaps.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-amber-500 ml-1">— puede haber movimientos ausentes en el extracto</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-500">Fecha anterior</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-500">Fecha actual</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-500 max-w-xs">Descripción</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Saldo anterior</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">+ Importe</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Esperado</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Saldo real</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((g, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-b-0 hover:bg-amber-50 transition-colors">
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{g.prevDate}</td>
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{g.currDate}</td>
                <td className="px-4 py-2 text-slate-700 max-w-xs truncate" title={g.descripcion}>{g.descripcion || '—'}</td>
                <td className="px-4 py-2 text-right text-slate-600 whitespace-nowrap">{formatEur(g.prevSaldo)}</td>
                <td className={`px-4 py-2 text-right whitespace-nowrap font-medium ${g.importe >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatEur(g.importe)}
                </td>
                <td className="px-4 py-2 text-right text-slate-400 whitespace-nowrap">{formatEur(g.expected)}</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-700 whitespace-nowrap">{formatEur(g.actual)}</td>
                <td className="px-4 py-2 text-right font-semibold text-amber-600 whitespace-nowrap">{formatEur(g.diff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
        Una diferencia puede indicar transacciones no incluidas en el extracto importado, o transacciones asignadas a la cuenta equivocada.
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function Cuentas() {
  const transactions = useTransactionStore((s) => s.transactions)
  const { accounts } = useAccountStore()
  const tooltipStyle = useTooltipStyle()

  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? null)
  const [granularity, setGranularity] = useState('all')   // 'all' | 'monthly'

  // Transactions for selected account that have saldo data, sorted by date asc
  const accountTxs = useMemo(() => {
    return [...transactions]
      .filter((t) => t.accountId === selectedAccountId && t.saldo != null)
      .sort((a, b) => new Date(a.fechaContable) - new Date(b.fechaContable))
  }, [transactions, selectedAccountId])

  // All transactions for selected account (incl. manual, no saldo required)
  const allAccountTxs = useMemo(() => {
    return [...transactions]
      .filter((t) => t.accountId === selectedAccountId)
      .sort((a, b) => new Date(a.fechaContable) - new Date(b.fechaContable))
  }, [transactions, selectedAccountId])

  // Chart data
  const chartData = useMemo(() => {
    if (granularity === 'monthly') {
      // One point per month: last saldo of the month
      const byMonth = {}
      accountTxs.forEach((t) => {
        const key = t.fechaContable?.slice(0, 7)
        if (!key) return
        byMonth[key] = t.saldo
      })
      return Object.entries(byMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, saldo]) => ({
          label: format(new Date(month + '-01'), 'MMM yyyy', { locale: es }),
          saldo,
        }))
    }
    // All points
    return accountTxs.map((t) => ({
      label: t.fechaContable
        ? format(new Date(t.fechaContable), 'dd/MM/yyyy')
        : '—',
      saldo: t.saldo,
      importe: t.importe,
      descripcion: t.descripcion,
    }))
  }, [accountTxs, granularity])

  // Consistency gaps
  const gaps = useMemo(() => {
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
        })
      }
    }
    return result
  }, [accountTxs])

  // Stats
  const stats = useMemo(() => {
    if (accountTxs.length === 0) return null
    const first = accountTxs[0]
    const last  = accountTxs[accountTxs.length - 1]
    const change = last.saldo - first.saldo
    return {
      firstDate:  format(new Date(first.fechaContable), 'dd/MM/yyyy'),
      lastDate:   format(new Date(last.fechaContable),  'dd/MM/yyyy'),
      firstSaldo: first.saldo,
      lastSaldo:  last.saldo,
      change,
      txCount: allAccountTxs.length,
      withSaldo: accountTxs.length,
    }
  }, [accountTxs, allAccountTxs])

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)

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
      ) : !selectedAccount ? null : accountTxs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          <p className="font-medium">No hay datos de saldo para "{selectedAccount.nombre}"</p>
          <p className="text-xs mt-2">
            El campo saldo está disponible en extractos bancarios importados en formato CSV/XLS.
            Los movimientos añadidos manualmente no tienen saldo de referencia.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700">
                Saldo de "{selectedAccount.nombre}"
              </h2>
              <div className="flex gap-1">
                {[['all', 'Todos los movimientos'], ['monthly', 'Por mes']].map(([v, lbl]) => (
                  <button
                    key={v}
                    onClick={() => setGranularity(v)}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                      granularity === v
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
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
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Verificación de coherencia</h2>
            <ConsistencyPanel gaps={gaps} />
          </div>
        </div>
      )}
    </div>
  )
}
