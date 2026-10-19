import { useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useSubcategoryStore from '../store/useSubcategoryStore'
import useBudgetStore from '../store/useBudgetStore'
import useRecurringStore from '../store/useRecurringStore'

// ─── helpers ────────────────────────────────────────────────────────────────

const formatEur = (amount) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)

// Y-axis tick: smart abbreviation that avoids duplicate labels
const formatYAxis = (v) => {
  const abs = Math.abs(v)
  if (abs >= 10000) return `${(v / 1000).toFixed(0)}k`
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v)
}

const MONTH_LABELS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTH_NAMES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Mix a hex color with white to produce a pastel version (amount 0–1, higher = more white)
function toPastel(hex, amount = 0.55) {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 0xff
  const g = (n >>  8) & 0xff
  const b =  n        & 0xff
  const pr = Math.round(r + (255 - r) * amount)
  const pg = Math.round(g + (255 - g) * amount)
  const pb = Math.round(b + (255 - b) * amount)
  return `rgb(${pr},${pg},${pb})`
}


// ─── sub-components ─────────────────────────────────────────────────────────

function SummaryCard({ title, value, subtitle, valueClass = 'text-slate-800', cardClass = '', borderClass = '' }) {
  return (
    <div className={`rounded-2xl p-5 flex flex-col gap-1 border ${cardClass} ${borderClass} bg-white/70 backdrop-blur-sm`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <p className={`text-2xl font-bold leading-tight ${valueClass}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
    </div>
  )
}

function useTooltipStyle() {
  const { dark } = useTheme()
  return dark
    ? { backgroundColor: '#233d4c', border: '1px solid #3a6070', color: '#e8f4f8' }
    : { backgroundColor: '#fff',    border: '1px solid #e2e8f0', color: '#1e293b' }
}

function CustomBarTooltip({ active, payload, label }) {
  const style = useTooltipStyle()
  if (!active || !payload?.length) return null
  return (
    <div style={style} className="rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatEur(p.value)}
        </p>
      ))}
    </div>
  )
}

function CustomLineTooltip({ active, payload, label }) {
  const style = useTooltipStyle()
  if (!active || !payload?.length) return null
  return (
    <div style={style} className="rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold mb-1">{MONTH_NAMES[label - 1] ?? label}</p>
      <p style={{ color: '#c4b5fd' }}>{formatEur(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

function CustomPieTooltip({ active, payload }) {
  const style = useTooltipStyle()
  if (!active || !payload?.length) return null
  return (
    <div style={style} className="rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold">{payload[0].name}</p>
      <p style={{ opacity: 0.75 }}>{formatEur(payload[0].value)}</p>
    </div>
  )
}

// ─── monthly table helper ────────────────────────────────────────────────────

function MonthlyTable({ rows, cols, colMaxima, isIncome = false }) {
  // Only highlight if the max value is unique in that column (not all rows equal)
  const colMaxIsUnique = cols.map((_, ci) => {
    const nonZero = rows.map((r) => r.cats[ci]).filter((v) => v > 0)
    return nonZero.length > 1 && nonZero.filter((v) => v === colMaxima.cats[ci]).length === 1
  })
  const otrosMaxIsUnique = (() => {
    const nonZero = rows.map((r) => r.otros).filter((v) => v > 0)
    return nonZero.length > 1 && nonZero.filter((v) => v === colMaxima.otros).length === 1
  })()
  const totalMaxIsUnique = (() => {
    const nonZero = rows.map((r) => r.total).filter((v) => v > 0)
    return nonZero.length > 1 && nonZero.filter((v) => v === colMaxima.total).length === 1
  })()

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left pb-2.5 text-slate-400 font-semibold uppercase tracking-wider pr-3 whitespace-nowrap">Mes</th>
            {cols.map((c) => (
              <th key={c.id} className="text-right pb-2.5 text-slate-400 font-semibold uppercase tracking-wider px-2 whitespace-nowrap">
                <span className="flex items-center justify-end gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                  {c.nombre.length > 10 ? c.nombre.slice(0, 9) + '…' : c.nombre}
                </span>
              </th>
            ))}
            <th className="text-right pb-2.5 text-slate-400 font-semibold uppercase tracking-wider px-2 whitespace-nowrap">Otros</th>
            <th className="text-right pb-2.5 text-slate-400 font-semibold uppercase tracking-wider pl-2 whitespace-nowrap">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
              <td className="py-2 pr-3 font-medium text-slate-600 whitespace-nowrap">{row.month.slice(0, 3)}</td>
              {row.cats.map((val, ci) => (
                <td
                  key={ci}
                  className="py-2 text-right px-2 font-medium whitespace-nowrap rounded"
                  style={val > 0 && val === colMaxima.cats[ci] && colMaxIsUnique[ci]
                    ? { backgroundColor: cols[ci].color + '33', color: cols[ci].color }
                    : undefined}
                >
                  <span className={val > 0 ? (val === colMaxima.cats[ci] && colMaxIsUnique[ci] ? '' : 'text-slate-700') : 'text-slate-300'}>
                    {val > 0 ? formatEur(val) : '—'}
                  </span>
                </td>
              ))}
              <td
                className="py-2 text-right px-2 font-medium whitespace-nowrap"
                style={row.otros > 0 && row.otros === colMaxima.otros && otrosMaxIsUnique
                  ? { backgroundColor: '#94a3b833', color: '#64748b' }
                  : undefined}
              >
                <span className={row.otros > 0 ? 'text-slate-700' : 'text-slate-300'}>
                  {row.otros > 0 ? formatEur(row.otros) : '—'}
                </span>
              </td>
              <td className={`py-2 text-right pl-2 font-bold whitespace-nowrap ${
                row.total > 0 && row.total === colMaxima.total && totalMaxIsUnique
                  ? (isIncome ? 'text-emerald-600' : 'text-rose-500')
                  : 'text-slate-800'
              }`}>
                {row.total > 0 ? formatEur(row.total) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const transactions  = useTransactionStore((s) => s.transactions)
  const categories    = useCategoryStore((s) => s.categories)
  const subcategories = useSubcategoryStore((s) => s.subcategories)
  const budgets       = useBudgetStore((s) => s.budgets)
  const recurringItems = useRecurringStore((s) => s.items)
  const { dark } = useTheme()

  const [selectedYear,       setSelectedYear]       = useState(new Date().getFullYear())
  const [selectedCategory,   setSelectedCategory]   = useState('')
  const [selectedCategories, setSelectedCategories] = useState([]) // multi-category comparison
  const [expandedCategories, setExpandedCategories] = useState(new Set())
  const [logScale,           setLogScale]           = useState(false)
  const [showCompareMonth,   setShowCompareMonth]   = useState(false)


  const toggleCategoryExpand = (id) =>
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const availableYears = useMemo(() => {
    const years = new Set(transactions.map((t) => new Date(t.fechaContable).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [transactions])

  const categoryMap = useMemo(() => {
    const m = {}
    categories.forEach((c) => (m[c.id] = c))
    return m
  }, [categories])

  // Categories to exclude from expense calculations
  const transferCatIds = useMemo(
    () => new Set(categories.filter((c) => c.esTransferencia).map((c) => c.id)),
    [categories]
  )
  const ingresoCatIds = useMemo(
    () => new Set(categories.filter((c) => c.esIngreso).map((c) => c.id)),
    [categories]
  )

  // All transactions for the year, excluding internal transfers
  const yearTx = useMemo(
    () => transactions.filter((t) =>
      new Date(t.fechaContable).getFullYear() === selectedYear &&
      !transferCatIds.has(t.categoria)
    ),
    [transactions, selectedYear, transferCatIds]
  )

  // Expense transactions: negative AND not in an ingreso category
  const gastosTx = useMemo(
    () => yearTx.filter((t) => t.importe < 0 && !ingresoCatIds.has(t.categoria)),
    [yearTx, ingresoCatIds]
  )

  // Income transactions: positive (regardless of category)
  const ingresosTx = useMemo(
    () => yearTx.filter((t) => t.importe > 0),
    [yearTx]
  )

  // ── summary ──
  const totalGastos   = useMemo(() => gastosTx.reduce((s, t) => s + Math.abs(t.importe), 0), [gastosTx])
  const totalIngresos = useMemo(() => ingresosTx.reduce((s, t) => s + t.importe, 0), [ingresosTx])
  const balance = totalIngresos - totalGastos

  const mesMaxGasto = useMemo(() => {
    const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 }))
    gastosTx.forEach((t) => {
      byMonth[new Date(t.fechaContable).getMonth()].total += Math.abs(t.importe)
    })
    const best = byMonth.reduce((a, b) => (b.total > a.total ? b : a), byMonth[0])
    return best.total > 0 ? { nombre: MONTH_NAMES[best.month], importe: best.total } : null
  }, [gastosTx])

  // ── budget progress (current month) ──
  const currentMonth = new Date().getMonth()
  const currentYear  = new Date().getFullYear()

  const budgetProgress = useMemo(() => {
    if (budgets.length === 0) return []
    const monthTx = transactions.filter((t) => {
      const d = new Date(t.fechaContable)
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth && t.importe < 0
    })
    return budgets.map((b) => {
      const cat = categories.find((c) => c.id === b.categoriaId)
      if (!cat) return null
      const spent = monthTx
        .filter((t) => t.categoria === b.categoriaId)
        .reduce((s, t) => s + Math.abs(t.importe), 0)
      const pct = b.limite > 0 ? Math.min((spent / b.limite) * 100, 100) : 0
      return { ...b, cat, spent, pct, over: spent > b.limite }
    }).filter(Boolean).sort((a, b) => b.pct - a.pct)
  }, [budgets, transactions, categories, currentMonth, currentYear])

  // ── monthly bar chart ──
  const monthlyData = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      mes: MONTH_LABELS[i],
      gastos:   gastosTx .filter((t) => new Date(t.fechaContable).getMonth() === i).reduce((s, t) => s + Math.abs(t.importe), 0),
      ingresos: ingresosTx.filter((t) => new Date(t.fechaContable).getMonth() === i).reduce((s, t) => s + t.importe, 0),
    })),
    [gastosTx, ingresosTx]
  )

  // ── gastos category breakdown ──
  const categoryBreakdown = useMemo(() => {
    const spend = {}
    gastosTx.forEach((t) => {
      const key = t.categoria || '__sin__'
      spend[key] = (spend[key] || 0) + Math.abs(t.importe)
    })
    return Object.entries(spend)
      .map(([id, total]) => ({
        id,
        nombre: id === '__sin__' ? 'Sin categoría' : (categoryMap[id]?.nombre ?? 'Desconocida'),
        color:  id === '__sin__' ? '#94a3b8'        : (categoryMap[id]?.color  ?? '#94a3b8'),
        total,
        pct: totalGastos > 0 ? (total / totalGastos) * 100 : 0,
      }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [gastosTx, categoryMap, totalGastos])

  // subcategory spend per category (for nested rows in breakdown)
  const subcatSpendByCat = useMemo(() => {
    const result = {}
    gastosTx.filter((t) => t.subcategoria).forEach((t) => {
      const catId = t.categoria || '__sin__'
      if (!result[catId]) result[catId] = {}
      result[catId][t.subcategoria] = (result[catId][t.subcategoria] || 0) + Math.abs(t.importe)
    })
    return result
  }, [gastosTx])

  // ── line chart for selected category ──
  const categoryLineData = useMemo(() => {
    if (!selectedCategory) return []
    return Array.from({ length: 12 }, (_, i) => {
      const total = gastosTx
        .filter((t) =>
          new Date(t.fechaContable).getMonth() === i &&
          (t.categoria === selectedCategory || (selectedCategory === '__sin__' && !t.categoria))
        )
        .reduce((s, t) => s + Math.abs(t.importe), 0)
      return { mes: i + 1, total }
    })
  }, [gastosTx, selectedCategory])

  const top8 = categoryBreakdown.slice(0, 8)

  // ── gastos monthly summary table (top 6 expense categories) ──
  const top6gastoCats = categoryBreakdown.slice(0, 6)

  const gastosMonthlySummary = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthTx = gastosTx.filter((t) => new Date(t.fechaContable).getMonth() === i)
      const byCat = {}
      monthTx.forEach((t) => { const k = t.categoria || '__sin__'; byCat[k] = (byCat[k] || 0) + Math.abs(t.importe) })
      const top6total = top6gastoCats.reduce((s, c) => s + (byCat[c.id] || 0), 0)
      const monthTotal = monthTx.reduce((s, t) => s + Math.abs(t.importe), 0)
      return { month: MONTH_NAMES[i], cats: top6gastoCats.map((c) => byCat[c.id] || 0), otros: monthTotal - top6total, total: monthTotal }
    })
  }, [gastosTx, top6gastoCats])

  const gastosColMaxima = useMemo(() => ({
    cats: top6gastoCats.map((_, ci) => Math.max(...gastosMonthlySummary.map((r) => r.cats[ci]))),
    otros: Math.max(...gastosMonthlySummary.map((r) => r.otros)),
    total: Math.max(...gastosMonthlySummary.map((r) => r.total)),
  }), [gastosMonthlySummary, top6gastoCats])

  // ── ingresos monthly summary table ──
  // Rows = months, Columns = subcategories of ingreso categories + "Sin subcat" + Total
  const ingresoSubcats = useMemo(() => {
    const catIds = Array.from(ingresoCatIds)
    return subcategories.filter((s) => catIds.includes(s.categoriaId))
  }, [subcategories, ingresoCatIds])

  // transactions that belong to ingreso categories
  const ingresosCatTx = useMemo(
    () => yearTx.filter((t) => ingresoCatIds.has(t.categoria)),
    [yearTx, ingresoCatIds]
  )

  const ingresosMonthlySummary = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthTx = ingresosCatTx.filter((t) => new Date(t.fechaContable).getMonth() === i)
      const bySubcat = {}
      monthTx.forEach((t) => {
        const key = t.subcategoria || '__sin__'
        bySubcat[key] = (bySubcat[key] || 0) + Math.abs(t.importe)
      })
      const subcatTotal = ingresoSubcats.reduce((s, sc) => s + (bySubcat[sc.id] || 0), 0)
      const monthTotal  = monthTx.reduce((s, t) => s + Math.abs(t.importe), 0)
      return {
        month: MONTH_NAMES[i],
        cats: ingresoSubcats.map((sc) => bySubcat[sc.id] || 0),
        otros: monthTotal - subcatTotal,
        total: monthTotal,
      }
    })
  }, [ingresosCatTx, ingresoSubcats])

  // Build col objects expected by MonthlyTable (id, nombre, color)
  const ingresoSubcatCols = ingresoSubcats.map((sc) => ({
    id: sc.id,
    nombre: sc.nombre,
    color: sc.color ?? categoryMap[sc.categoriaId]?.color ?? '#16a34a',
  }))
  // If no subcategories defined, fall back to showing ingreso categories as columns
  const ingresoColDefs = ingresoSubcatCols.length > 0 ? ingresoSubcatCols : (() => {
    const cats = Array.from(ingresoCatIds).map((id) => categoryMap[id]).filter(Boolean)
    return cats.map((c) => ({ id: c.id, nombre: c.nombre, color: c.color }))
  })()

  const ingresosMonthlySummaryFinal = useMemo(() => {
    if (ingresoSubcatCols.length > 0) return ingresosMonthlySummary
    // fallback: columns = ingreso categories
    return Array.from({ length: 12 }, (_, i) => {
      const monthTx = ingresosTx.filter((t) => new Date(t.fechaContable).getMonth() === i && ingresoCatIds.has(t.categoria))
      const byCat = {}
      monthTx.forEach((t) => { byCat[t.categoria] = (byCat[t.categoria] || 0) + t.importe })
      const catTotal = ingresoColDefs.reduce((s, c) => s + (byCat[c.id] || 0), 0)
      const monthAllIncome = ingresosTx.filter((t) => new Date(t.fechaContable).getMonth() === i).reduce((s, t) => s + t.importe, 0)
      return {
        month: MONTH_NAMES[i],
        cats: ingresoColDefs.map((c) => byCat[c.id] || 0),
        otros: monthAllIncome - catTotal,
        total: monthAllIncome,
      }
    })
  }, [ingresosMonthlySummary, ingresoSubcatCols.length, ingresosTx, ingresoColDefs, ingresoCatIds])

  const ingresosColMaxima = useMemo(() => ({
    cats: ingresoColDefs.map((_, ci) => Math.max(...ingresosMonthlySummaryFinal.map((r) => r.cats[ci]))),
    otros: Math.max(...ingresosMonthlySummaryFinal.map((r) => r.otros)),
    total: Math.max(...ingresosMonthlySummaryFinal.map((r) => r.total)),
  }), [ingresosMonthlySummaryFinal, ingresoColDefs])

  const hasIngresoData = ingresosMonthlySummaryFinal.some((r) => r.total > 0)

  // ── month-by-month year comparison ──
  const prevYear = selectedYear - 1
  const hasPrevYear = availableYears.includes(prevYear)
  const monthCompareData = useMemo(() => {
    if (!hasPrevYear) return []
    const prevYearTx = transactions.filter((t) =>
      new Date(t.fechaContable).getFullYear() === prevYear && !transferCatIds.has(t.categoria)
    )
    const prevGastos = prevYearTx.filter((t) => t.importe < 0 && !ingresoCatIds.has(t.categoria))
    return Array.from({ length: 12 }, (_, i) => ({
      mes: MONTH_LABELS[i],
      [`gastos_${selectedYear}`]: gastosTx.filter((t) => new Date(t.fechaContable).getMonth() === i).reduce((s, t) => s + Math.abs(t.importe), 0),
      [`gastos_${prevYear}`]: prevGastos.filter((t) => new Date(t.fechaContable).getMonth() === i).reduce((s, t) => s + Math.abs(t.importe), 0),
    }))
  }, [gastosTx, transactions, selectedYear, prevYear, hasPrevYear, transferCatIds, ingresoCatIds])

  // ── multi-category line comparison ──
  const COMPARE_COLORS = ['#8b5cf6', '#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#ec4899']
  const multiCategoryLineData = useMemo(() => {
    if (selectedCategories.length === 0) return []
    return Array.from({ length: 12 }, (_, i) => {
      const row = { mes: i + 1 }
      selectedCategories.forEach((catId) => {
        row[catId] = gastosTx
          .filter((t) => new Date(t.fechaContable).getMonth() === i && (t.categoria === catId || (catId === '__sin__' && !t.categoria)))
          .reduce((s, t) => s + Math.abs(t.importe), 0)
      })
      return row
    })
  }, [gastosTx, selectedCategories])

  // ── multi-year comparison ──
  const yearlyComparison = useMemo(() => {
    return availableYears.slice().reverse().map((year) => {
      const txYear = transactions.filter((t) =>
        new Date(t.fechaContable).getFullYear() === year && !transferCatIds.has(t.categoria)
      )
      const gastos   = txYear.filter((t) => t.importe < 0 && !ingresoCatIds.has(t.categoria)).reduce((s, t) => s + Math.abs(t.importe), 0)
      const ingresos = txYear.filter((t) => t.importe > 0).reduce((s, t) => s + t.importe, 0)
      return { year, gastos, ingresos, balance: ingresos - gastos }
    })
  }, [availableYears, transactions, transferCatIds, ingresoCatIds])

  // ── recurring / fixed expenses (compact) ──
  const PERIOD_FACTOR = { mensual: 1, bimestral: 0.5, trimestral: 1 / 3, semestral: 1 / 6, anual: 1 / 12 }

  // Filter out expired items (fechaFin in the past)
  const activeRecurring = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return recurringItems.filter((r) => r.activo && (!r.fechaFin || r.fechaFin >= today))
  }, [recurringItems])

  // Split recurring into income vs expense based on category esIngreso flag
  const fixedIncomeMonthly = useMemo(
    () => activeRecurring
      .filter((r) => r.categoriaId && ingresoCatIds.has(r.categoriaId))
      .reduce((s, r) => s + r.importe * (PERIOD_FACTOR[r.periodicidad] || 1), 0),
    [activeRecurring, ingresoCatIds],
  )
  const fixedExpenseMonthly = useMemo(
    () => activeRecurring
      .filter((r) => !r.categoriaId || !ingresoCatIds.has(r.categoriaId))
      .reduce((s, r) => s + r.importe * (PERIOD_FACTOR[r.periodicidad] || 1), 0),
    [activeRecurring, ingresoCatIds],
  )

  // Variable expenses already spent this month
  const variableSpentThisMonth = useMemo(() => {
    return transactions.filter((t) => {
      const d = new Date(t.fechaContable)
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth &&
        t.importe < 0 && !transferCatIds.has(t.categoria) && !ingresoCatIds.has(t.categoria)
    }).reduce((s, t) => s + Math.abs(t.importe), 0)
  }, [transactions, currentYear, currentMonth, transferCatIds, ingresoCatIds])

  const availableEstimate = fixedIncomeMonthly - fixedExpenseMonthly - variableSpentThisMonth

  // Which fixed expenses have already been paid this month?
  const fixedStatus = useMemo(() => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const monthTx = transactions.filter((t) => {
      const d = new Date(t.fechaContable)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear && t.importe < 0
    })

    return activeRecurring.map((r) => {
      const norm = r.nombre.toUpperCase().slice(0, 20)
      const match = monthTx.find((t) =>
        (t.descripcion || '').toUpperCase().includes(norm) &&
        Math.abs(Math.abs(t.importe) - r.importe) < r.importe * 0.3, // within 30% tolerance
      )
      return { ...r, paid: !!match, paidAmount: match ? Math.abs(match.importe) : null }
    })
  }, [recurringItems, transactions])

  // ── empty state ──
  if (transactions.length === 0) {
    return (
      <div className="dashboard-bg min-h-screen p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-16 text-center">
          <p className="text-slate-400 text-lg font-medium">No hay movimientos aún.</p>
          <p className="text-slate-400 text-sm mt-1">
            Ve a <strong>Importar</strong> para cargar tu extracto bancario.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-bg space-y-6 p-1">

      {/* ── 1. Gradient header ── */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-700">Dashboard</h1>
            <p className="text-slate-400 text-sm mt-0.5">Resumen financiero anual</p>
          </div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-full px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="Gastos del año" value={formatEur(totalGastos)} subtitle={`${gastosTx.length} movimientos`} valueClass="text-rose-500" cardClass="bg-rose-50" borderClass="border-rose-200" />
          <SummaryCard title="Ingresos del año" value={formatEur(totalIngresos)} subtitle={`${ingresosTx.length} movimientos`} valueClass="text-emerald-600" cardClass="bg-emerald-50" borderClass="border-emerald-200" />
          <SummaryCard title="Balance" value={formatEur(balance)} subtitle="Ingresos − Gastos" valueClass={balance >= 0 ? 'text-emerald-600' : 'text-rose-500'} cardClass="bg-violet-50" borderClass="border-violet-200" />
          <SummaryCard title="Mes con más gasto" value={mesMaxGasto ? mesMaxGasto.nombre : '—'} subtitle={mesMaxGasto ? formatEur(mesMaxGasto.importe) : 'Sin datos'} valueClass="text-amber-700" cardClass="bg-amber-50" borderClass="border-amber-200" />
        </div>
      </div>

      {/* ── Forecast widget (compact) ── */}
      {(activeRecurring.length > 0 || budgetProgress.length > 0) && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-cyan-200 p-6">
          <div className="flex items-center justify-between mb-1">
            <p className="text-slate-600 font-semibold text-sm uppercase tracking-wider">📋 Previsión del mes</p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-slate-400">{MONTH_NAMES[currentMonth]} {currentYear}</p>
              <a href="#/gastos-fijos" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Ver todo →</a>
            </div>
          </div>

          {/* Forecast metrics */}
          {activeRecurring.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3 mb-4">
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-[11px] text-emerald-600 uppercase font-semibold">Ingresos fijos</p>
                <p className="text-lg font-bold text-emerald-700">{formatEur(fixedIncomeMonthly)}</p>
              </div>
              <div className="bg-rose-50 rounded-xl p-3">
                <p className="text-[11px] text-rose-600 uppercase font-semibold">Gastos fijos</p>
                <p className="text-lg font-bold text-rose-600">{formatEur(fixedExpenseMonthly)}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-[11px] text-amber-600 uppercase font-semibold">Pagados / Pendientes</p>
                <p className="text-lg font-bold text-amber-700">
                  {fixedStatus.filter((r) => r.paid).length} / {fixedStatus.filter((r) => !r.paid).length}
                </p>
              </div>
              <div className={`rounded-xl p-3 ${availableEstimate >= 0 ? 'bg-indigo-50' : 'bg-red-50'}`}>
                <p className={`text-[11px] uppercase font-semibold ${availableEstimate >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>Disponible estimado</p>
                <p className={`text-lg font-bold ${availableEstimate >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{formatEur(availableEstimate)}</p>
              </div>
            </div>
          )}

          {/* Top budget bars (up to 4) */}
          {budgetProgress.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Presupuestos</p>
              {budgetProgress.slice(0, 4).map((b) => (
                <div key={b.categoriaId}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.cat.color }} />
                      <span className="text-xs text-slate-600">{b.cat.nombre}</span>
                    </div>
                    <span className={`text-xs font-semibold ${b.over ? 'text-red-500' : 'text-slate-500'}`}>
                      {formatEur(b.spent)} / {formatEur(b.limite)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.over ? 'bg-red-400' : b.pct > 75 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 2. Monthly bar chart ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-1">
          <p className="text-slate-600 font-semibold text-sm uppercase tracking-wider">📊 Evolución mensual</p>
          <div className="flex items-center gap-2">
            {hasPrevYear && (
              <button
                onClick={() => setShowCompareMonth((v) => !v)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${showCompareMonth ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
              >
                {showCompareMonth ? `vs ${prevYear}` : 'Comparar'}
              </button>
            )}
            <button
              onClick={() => setLogScale((v) => !v)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${logScale ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
            >
              {logScale ? 'Escala √' : 'Escala lineal'}
            </button>
          </div>
        </div>
        <p className="text-slate-400 text-xs mb-5">Gastos e ingresos mes a mes · {selectedYear}</p>
        <div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#2a4d5c' : '#f1f5f9'} />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: dark ? '#82b4c8' : '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: dark ? '#5a90a8' : '#94a3b8' }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} scale={logScale ? 'sqrt' : 'auto'} domain={logScale ? [0, 'auto'] : [0, 'auto']} />
            <Tooltip content={<CustomBarTooltip />} cursor={{ fill: dark ? '#2d5264' : '#f8fafc' }} />
            <Legend formatter={(value) => <span className="text-xs text-slate-600 capitalize">{value}</span>} iconType="circle" iconSize={8} />
            <Bar dataKey="gastos"   name="Gastos"   fill="#fca5a5" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ingresos" name="Ingresos" fill="#6ee7b7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>

        {/* Month-by-month year comparison */}
        {showCompareMonth && hasPrevYear && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-500 text-xs font-medium">Gastos: {selectedYear} vs {prevYear}</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={monthCompareData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#2a4d5c' : '#f1f5f9'} />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: dark ? '#82b4c8' : '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: dark ? '#5a90a8' : '#94a3b8' }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: dark ? '#2d5264' : '#f8fafc' }} />
                <Legend formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} iconType="circle" iconSize={8} />
                <Bar dataKey={`gastos_${selectedYear}`} name={`${selectedYear}`} fill="#fca5a5" radius={[4, 4, 0, 0]} />
                <Bar dataKey={`gastos_${prevYear}`} name={`${prevYear}`} fill="#c4b5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── 3. Pie / line chart (standalone) ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-emerald-200 p-6">
        <div className="flex flex-wrap items-start gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-slate-600 font-semibold text-sm uppercase tracking-wider mb-0.5">
              🥧 {selectedCategories.length > 0 ? 'Comparación de categorías' : selectedCategory ? 'Evolución mensual de categoría' : 'Distribución de gastos'}
            </p>
            <p className="text-slate-400 text-xs">
              {selectedCategories.length > 0 ? 'Gasto mensual de las categorías seleccionadas' : selectedCategory ? 'Gasto mensual de la categoría seleccionada' : 'Top 8 categorías de gasto'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => { setSelectedCategory(e.target.value); setSelectedCategories([]) }}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 max-w-[200px]"
            >
              <option value="">— Ver distribución —</option>
              {categoryBreakdown.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {categoryBreakdown.length > 1 && (
              <button
                onClick={() => {
                  if (selectedCategories.length > 0) {
                    setSelectedCategories([])
                  } else {
                    setSelectedCategories(categoryBreakdown.slice(0, 4).map((c) => c.id))
                    setSelectedCategory('')
                  }
                }}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${selectedCategories.length > 0 ? 'bg-violet-100 border-violet-300 text-violet-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
              >
                {selectedCategories.length > 0 ? 'Quitar comparación' : 'Comparar categorías'}
              </button>
            )}
          </div>
        </div>

        {/* Multi-category selector chips */}
        {selectedCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {categoryBreakdown.slice(0, 10).map((c, i) => {
              const active = selectedCategories.includes(c.id)
              return (
                <button key={c.id}
                  onClick={() => setSelectedCategories((prev) => active ? prev.filter((id) => id !== c.id) : prev.length < 6 ? [...prev, c.id] : prev)}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${active ? 'border-transparent font-medium' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                  style={active ? { backgroundColor: c.color + '22', color: c.color, borderColor: c.color + '44' } : undefined}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.nombre}
                </button>
              )
            })}
            <span className="text-xs text-slate-400 self-center ml-1">(máx. 6)</span>
          </div>
        )}
        {selectedCategories.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={multiCategoryLineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#2a4d5c' : '#f1f5f9'} />
              <XAxis dataKey="mes" tickFormatter={(v) => MONTH_LABELS[v - 1]} tick={{ fontSize: 11, fill: dark ? '#82b4c8' : '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: dark ? '#5a90a8' : '#94a3b8' }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomBarTooltip />} />
              {selectedCategories.map((catId, i) => {
                const cat = categoryBreakdown.find((c) => c.id === catId)
                return <Line key={catId} type="monotone" dataKey={catId} name={cat?.nombre || catId} stroke={cat?.color || COMPARE_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : selectedCategory ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={categoryLineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#2a4d5c' : '#f1f5f9'} />
              <XAxis dataKey="mes" tickFormatter={(v) => MONTH_LABELS[v - 1]} tick={{ fontSize: 11, fill: dark ? '#82b4c8' : '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: dark ? '#5a90a8' : '#94a3b8' }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomLineTooltip />} />
              <Line type="monotone" dataKey="total" stroke="#c4b5fd" strokeWidth={2} dot={{ r: 3, fill: '#c4b5fd' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : top8.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-slate-400 text-sm">Sin datos</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={top8} dataKey="total" nameKey="nombre" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2} stroke="none">
                {top8.map((entry) => <Cell key={entry.id} fill={toPastel(entry.color)} />)}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 4. Gastos mensuales por categoría ── */}
      {top6gastoCats.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-rose-200 p-6">
          <p className="text-slate-600 font-semibold text-sm uppercase tracking-wider mb-0.5">📅 Gastos mensuales por categoría</p>
          <p className="text-slate-400 text-xs mb-4">Top {top6gastoCats.length} categorías de gasto por mes · {selectedYear}</p>
          <MonthlyTable rows={gastosMonthlySummary} cols={top6gastoCats} colMaxima={gastosColMaxima} isIncome={false} />
        </div>
      )}

      {/* ── 5. Ingresos mensuales (categoría Ingresos + subcategorías) ── */}
      {hasIngresoData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-emerald-200 p-6">
          <p className="text-slate-600 font-semibold text-sm uppercase tracking-wider mb-0.5">📅 Ingresos mensuales por subcategoría</p>
          <p className="text-slate-400 text-xs mb-4">
            {ingresoSubcatCols.length > 0
              ? `Desglose por subcategorías de ingresos · ${selectedYear}`
              : `Ingresos por mes · ${selectedYear} · Define subcategorías para mayor detalle`}
          </p>
          <MonthlyTable rows={ingresosMonthlySummaryFinal} cols={ingresoColDefs} colMaxima={ingresosColMaxima} isIncome={true} />
        </div>
      )}

      {/* ── 6. Comparativa anual ── */}
      {yearlyComparison.length > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-indigo-200 p-6">
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-slate-600 font-semibold text-sm uppercase tracking-wider">📅 Comparativa anual</p>
          </div>
          <p className="text-slate-400 text-xs mb-5">Evolución de gastos, ingresos y balance por año</p>

          {/* Bar chart */}
          <div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={yearlyComparison} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#2a4d5c' : '#f1f5f9'} />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: dark ? '#82b4c8' : '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: dark ? '#5a90a8' : '#94a3b8' }} tickFormatter={formatYAxis} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomBarTooltip />} cursor={{ fill: dark ? '#2d5264' : '#f8fafc' }} />
              <Legend formatter={(value) => <span className="text-xs text-slate-600 capitalize">{value}</span>} iconType="circle" iconSize={8} />
              <Bar dataKey="gastos"   name="Gastos"   fill="#fca5a5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ingresos" name="Ingresos" fill="#6ee7b7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left pb-2 text-slate-400 font-semibold text-xs uppercase tracking-wider">Año</th>
                  <th className="text-right pb-2 text-slate-400 font-semibold text-xs uppercase tracking-wider">Gastos</th>
                  <th className="text-right pb-2 text-slate-400 font-semibold text-xs uppercase tracking-wider">vs anterior</th>
                  <th className="text-right pb-2 text-slate-400 font-semibold text-xs uppercase tracking-wider">Ingresos</th>
                  <th className="text-right pb-2 text-slate-400 font-semibold text-xs uppercase tracking-wider">vs anterior</th>
                  <th className="text-right pb-2 text-slate-400 font-semibold text-xs uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody>
                {yearlyComparison.slice().reverse().map((row, i, arr) => {
                  const prev = arr[i + 1]
                  const gastoDiff   = prev && prev.gastos   > 0 ? ((row.gastos   - prev.gastos)   / prev.gastos)   * 100 : null
                  const ingresoDiff = prev && prev.ingresos > 0 ? ((row.ingresos - prev.ingresos) / prev.ingresos) * 100 : null
                  const Diff = ({ val, positiveIsGood = false }) => {
                    if (val === null) return <span className="text-slate-300 text-xs">—</span>
                    const up = val > 0
                    const good = positiveIsGood ? up : !up
                    return (
                      <span className={`text-xs font-medium ${good ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {up ? '▲' : '▼'} {Math.abs(val).toFixed(1)}%
                      </span>
                    )
                  }
                  return (
                    <tr key={row.year} className={`border-b border-slate-50 last:border-b-0 ${row.year === selectedYear ? 'bg-indigo-50' : 'hover:bg-slate-50'} transition-colors`}>
                      <td className={`py-2.5 font-semibold ${row.year === selectedYear ? 'text-indigo-700' : 'text-slate-700'}`}>{row.year}</td>
                      <td className="py-2.5 text-right text-rose-500 font-medium whitespace-nowrap">{formatEur(row.gastos)}</td>
                      <td className="py-2.5 text-right"><Diff val={gastoDiff} positiveIsGood={false} /></td>
                      <td className="py-2.5 text-right text-emerald-600 font-medium whitespace-nowrap">{formatEur(row.ingresos)}</td>
                      <td className="py-2.5 text-right"><Diff val={ingresoDiff} positiveIsGood={true} /></td>
                      <td className={`py-2.5 text-right font-bold whitespace-nowrap ${row.balance >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{formatEur(row.balance)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ── 8. Desglose por categoría con subcategorías (al final) ── */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 border-t-4 border-t-violet-200 p-6">
          <p className="text-slate-600 font-semibold text-sm uppercase tracking-wider mb-0.5">🏷️ Desglose por categoría</p>
          <p className="text-slate-400 text-xs mb-4">Distribución de gastos con subcategorías · {selectedYear}</p>
          <div className="overflow-x-auto">
            {/* Header */}
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: '42%' }} />
                <col style={{ width: '17%' }} />
                <col style={{ width: '13%' }} />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left pb-2 text-slate-400 font-semibold text-xs uppercase tracking-wider">Categoría / Subcategoría</th>
                  <th className="text-right pb-2 text-slate-400 font-semibold text-xs uppercase tracking-wider pr-4">Importe</th>
                  <th className="text-right pb-2 text-slate-400 font-semibold text-xs uppercase tracking-wider">% gastos</th>
                  <th className="pb-2 pl-4"></th>
                </tr>
              </thead>
            </table>
            {/* Scrollable body */}
            <div className="overflow-y-auto" style={{ maxHeight: '352px' }}>
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: '42%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '13%' }} />
                  <col />
                </colgroup>
                <tbody>
                  {categoryBreakdown.map((cat) => {
                    const catSubcats = subcategories.filter((s) => s.categoriaId === cat.id)
                    const subcatSpend = subcatSpendByCat[cat.id] || {}
                    const hasSubcatData = catSubcats.some((s) => subcatSpend[s.id] > 0)
                    const sinSubcatTotal = cat.total - catSubcats.reduce((s, sc) => s + (subcatSpend[sc.id] || 0), 0)
                    const isExpanded = expandedCategories.has(cat.id)
                    return (
                      <>
                        {/* Category row */}
                        <tr key={cat.id} className="border-b border-slate-100 bg-slate-50/50">
                          <td className="py-2.5">
                            <button
                              onClick={() => hasSubcatData && toggleCategoryExpand(cat.id)}
                              className={`flex items-center gap-2 w-full text-left ${hasSubcatData ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              {hasSubcatData ? (
                                <span className="text-slate-400 text-xs w-3 flex-shrink-0">{isExpanded ? '▾' : '▸'}</span>
                              ) : (
                                <span className="w-3 flex-shrink-0" />
                              )}
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                              <span className="text-slate-700 font-semibold truncate">{cat.nombre}</span>
                            </button>
                          </td>
                          <td className="py-2.5 text-right font-bold text-slate-800 pr-4 whitespace-nowrap">{formatEur(cat.total)}</td>
                          <td className="py-2.5 text-right text-slate-500 whitespace-nowrap">{cat.pct.toFixed(1)}%</td>
                          <td className="py-2.5 pl-4">
                            <div className="bg-slate-100 rounded-full h-1.5">
                              <div className="h-1.5 rounded-full transition-all" style={{ width: `${cat.pct}%`, backgroundColor: cat.color }} />
                            </div>
                          </td>
                        </tr>
                        {/* Subcategory rows — only when expanded */}
                        {isExpanded && hasSubcatData && catSubcats.filter((s) => subcatSpend[s.id] > 0).map((sc) => {
                          const scTotal = subcatSpend[sc.id] || 0
                          const scPct = cat.total > 0 ? (scTotal / cat.total) * 100 : 0
                          return (
                            <tr key={sc.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="py-2 pl-8">
                                <div className="flex items-center gap-2 text-slate-500">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sc.color ?? cat.color }} />
                                  <span className="truncate">{sc.nombre}</span>
                                </div>
                              </td>
                              <td className="py-2 text-right text-slate-600 pr-4 whitespace-nowrap">{formatEur(scTotal)}</td>
                              <td className="py-2 text-right text-slate-400 text-xs whitespace-nowrap">{scPct.toFixed(1)}%</td>
                              <td className="py-2 pl-4">
                                <div className="bg-slate-100 rounded-full h-1">
                                  <div className="h-1 rounded-full" style={{ width: `${scPct}%`, backgroundColor: sc.color ?? cat.color }} />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {isExpanded && hasSubcatData && sinSubcatTotal > 0.01 && (
                          <tr key={`${cat.id}-sin`} className="border-b border-slate-50">
                            <td className="py-2 pl-8 text-slate-400 italic">Sin subcategoría</td>
                            <td className="py-2 text-right text-slate-400 pr-4 whitespace-nowrap">{formatEur(sinSubcatTotal)}</td>
                            <td className="py-2 text-right text-slate-300 text-xs whitespace-nowrap">{(cat.total > 0 ? sinSubcatTotal / cat.total * 100 : 0).toFixed(1)}%</td>
                            <td />
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
