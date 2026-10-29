import { useRef, useState } from 'react'
import useAccountStore from '../store/useAccountStore'
import useGoalStore from '../store/useGoalStore'
import useGoalResults from '../hooks/useGoalResults'
import SelectSheet from '../components/SelectSheet'
import MonthChips from '../components/MonthChips'
import { goalStart } from '../insights/goals'
import { monthKeyLabel as monthLabel } from '../utils/period'

const formatEur = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
const EMPTY_FORM = { nombre: '', importeMensual: '', objetivo: '', fechaObjetivo: '', inicial: '', modo: 'apartado', accountId: '', desde: '' }

function ProgressBar({ value, max, className = 'bg-emerald-400' }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${className}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function GoalCard({ result: r, accounts, onEdit }) {
  const g = r.goal
  const account = accounts.find((a) => a.id === g.accountId)
  const how = g.modo === 'cuenta' ? `traspaso a ${account?.nombre ?? 'una cuenta eliminada'}` : 'apartado, sin moverlo'
  const cur = r.current

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 truncate">{g.tipo === 'meta' ? '🎯' : '🐷'} {g.nombre}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {g.tipo === 'meta' ? `${formatEur(g.objetivo)} para ${monthLabel(g.fechaObjetivo)}` : `${formatEur(g.importeMensual)} al mes`} · {how}
          </p>
        </div>
        <button onClick={onEdit} className="text-xs text-slate-400 hover:text-slate-600 shrink-0 px-1 py-1">editar</button>
      </div>

      {!r.started ? (
        <p className="text-sm text-slate-500">Empieza en {monthLabel(goalStart(g))}.</p>
      ) : (
        <>
          {g.tipo === 'meta' ? (
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-lg font-bold text-slate-800">{formatEur(r.accumulated)}</span>
                <span className="text-xs text-slate-400">de {formatEur(g.objetivo)}</span>
              </div>
              <ProgressBar value={r.accumulated} max={g.objetivo} className={r.meta.reached ? 'bg-emerald-400' : 'bg-violet-400'} />
              <p className={`text-xs mt-1.5 ${r.meta.overdue ? 'text-rose-500' : 'text-slate-500'}`}>
                {r.meta.reached ? '🎉 ¡Meta conseguida!'
                  : r.meta.overdue ? `La fecha ya ha pasado: faltan ${formatEur(r.meta.remaining)}`
                  : `Faltan ${formatEur(r.meta.remaining)}: ${formatEur(cur?.quota ?? 0)} al mes durante ${r.meta.monthsLeft} ${r.meta.monthsLeft === 1 ? 'mes' : 'meses'}`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Ahorrado desde {monthLabel(r.months[0]?.key)}: <strong className="text-slate-800">{formatEur(r.accumulated)}</strong>
              <span className="text-slate-400"> de {formatEur(r.expected)} previstos</span>
            </p>
          )}

          {cur && cur.quota > 0 && (
            <div>
              <p className="text-[11px] text-slate-400 uppercase font-semibold mb-1">Este mes</p>
              {g.modo === 'cuenta' ? (
                <>
                  <ProgressBar value={cur.contributed ?? 0} max={cur.quota} />
                  <p className="text-xs text-slate-500 mt-1">
                    {formatEur(cur.contributed ?? 0)} de {formatEur(cur.quota)}{cur.pending > 0 ? ` · faltan ${formatEur(cur.pending)}` : ' ✓'}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-500">{formatEur(cur.quota)} reservados: se comprueba al acabar el mes con lo que te sobre</p>
              )}
            </div>
          )}

          {r.months.length > 1 && <MonthChips months={r.months} />}
        </>
      )}
    </div>
  )
}

export default function Ahorro() {
  const accounts = useAccountStore((s) => s.accounts)
  const { goals, addGoal, updateGoal, deleteGoal } = useGoalStore()
  const { results } = useGoalResults()

  const [form, setForm] = useState(null) // null | { tipo, ...EMPTY_FORM }
  const [editingId, setEditingId] = useState(null)
  const formRef = useRef(null)

  const savings = results.filter((r) => r.goal.tipo !== 'meta')
  const metas = results.filter((r) => r.goal.tipo === 'meta')
  // Una cuenta de ahorro solo puede ser de un plan: si no, lo traspasado contaría para los dos
  const usedAccounts = new Set(goals.filter((g) => g.modo === 'cuenta' && g.id !== editingId).map((g) => g.accountId))

  function openForm(tipo, goal = null) {
    setEditingId(goal?.id ?? null)
    setForm(goal
      ? { ...EMPTY_FORM, ...Object.fromEntries(Object.entries(goal).map(([k, v]) => [k, v == null ? '' : String(v)])), tipo: goal.tipo }
      : { ...EMPTY_FORM, tipo })
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const close = () => { setForm(null); setEditingId(null) }
  const field = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const isMeta = form?.tipo === 'meta'
  const valid = form && form.nombre.trim() &&
    (isMeta ? parseFloat(form.objetivo) > 0 && form.fechaObjetivo : parseFloat(form.importeMensual) > 0) &&
    (form.modo !== 'cuenta' || form.accountId)

  async function handleSave() {
    if (!valid) return
    const data = {
      tipo: form.tipo,
      nombre: form.nombre.trim(),
      modo: form.modo,
      accountId: form.modo === 'cuenta' ? form.accountId : null,
      desde: form.desde || null,
      ...(isMeta
        ? { objetivo: parseFloat(form.objetivo), fechaObjetivo: form.fechaObjetivo, inicial: parseFloat(form.inicial) || 0 }
        : { importeMensual: parseFloat(form.importeMensual) }),
    }
    if (editingId) await updateGoal(editingId, data)
    else await addGoal(data)
    close()
  }

  async function handleDelete() {
    if (!editingId || !window.confirm(`¿Eliminar «${form.nombre}»? No se borra ningún movimiento.`)) return
    await deleteGoal(editingId)
    close()
  }

  const input = 'border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Ahorro y metas</h1>
          <p className="hidden lg:block text-slate-400 text-sm mt-0.5">Lo que quieres guardar cada mes y para qué</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openForm('ahorro')} className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">+ Ahorro</button>
          <button onClick={() => openForm('meta')} className="px-3 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg">+ Meta</button>
        </div>
      </div>

      {form && (
        <div ref={formRef} className="scroll-mt-20 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            {editingId ? 'Editar' : isMeta ? 'Nueva meta' : 'Nuevo plan de ahorro'}
          </p>
          <p className="text-xs text-slate-400">
            {isMeta
              ? 'Una cantidad para una fecha (un viaje, un coche…). Cada mes te dice cuánto apartar para llegar a tiempo.'
              : 'Una cantidad fija al mes, sin una finalidad concreta.'}
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <input placeholder={isMeta ? 'Nombre (p. ej. Viaje a Japón)' : 'Nombre (p. ej. Colchón)'} value={form.nombre} onChange={field('nombre')}
              className={`${input} flex-1 min-w-[160px]`} autoFocus />
            {isMeta ? (
              <>
                <input type="number" min="0" step="10" placeholder="Objetivo €" value={form.objetivo} onChange={field('objetivo')} className={`${input} w-28`} />
                <label className="flex items-center gap-1 text-xs text-slate-400">Para
                  <input type="month" value={form.fechaObjetivo} onChange={field('fechaObjetivo')} className={`${input} px-2`} />
                </label>
                <input type="number" min="0" step="10" placeholder="Ya tengo €" value={form.inicial} onChange={field('inicial')} className={`${input} w-28`} title="Lo que ya tienes ahorrado para esta meta" />
              </>
            ) : (
              <input type="number" min="0" step="10" placeholder="€ al mes" value={form.importeMensual} onChange={field('importeMensual')} className={`${input} w-28`} />
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <SelectSheet title="Cómo lo apartas" value={form.modo}
              onChange={(v) => setForm((f) => ({ ...f, modo: v }))}
              options={[{ value: 'apartado', label: 'Sin moverlo (apartado)' }, { value: 'cuenta', label: 'Traspaso a una cuenta' }]} />
            {form.modo === 'cuenta' && (
              <SelectSheet title="Cuenta de ahorro" value={form.accountId}
                onChange={(v) => setForm((f) => ({ ...f, accountId: v }))}
                options={[{ value: '', label: 'Cuenta…' }, ...accounts.filter((a) => !usedAccounts.has(a.id)).map((a) => ({ value: a.id, label: a.nombre, color: a.color }))]} />
            )}
            <label className="flex items-center gap-1 text-xs text-slate-400">Desde
              <input type="month" value={form.desde} onChange={field('desde')} className={`${input} px-2`} />
            </label>
          </div>
          <p className="text-xs text-slate-400">
            {form.modo === 'cuenta'
              ? 'Cuenta lo que llega a esa cuenta por traspasos desde tus otras cuentas (y resta lo que sacas). Si no importas sus extractos, crea una categoría de transferencia (p. ej. «Ahorro») con esa cuenta como destino.'
              : 'Cada mes cuenta lo que te sobra (ingresos − gastos) hasta esta cantidad; si tienes varios planes así, se reparte por orden de creación.'}
            {' '}Sin «Desde», empieza este mes; con una fecha anterior verás también los meses pasados.
          </p>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!valid}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50">{editingId ? 'Guardar' : 'Añadir'}</button>
            <button onClick={close} className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-600">Cancelar</button>
            {editingId && <button onClick={handleDelete} className="ml-auto px-3 py-1.5 text-sm text-red-500 hover:text-red-700">Eliminar</button>}
          </div>
        </div>
      )}

      {results.length === 0 && !form && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 space-y-2">
          <p className="text-3xl">🐷</p>
          <p className="font-medium text-slate-700">Aún no tienes planes de ahorro ni metas</p>
          <p className="text-sm">Con <strong>+ Ahorro</strong> guardas una cantidad cada mes; con <strong>+ Meta</strong>, reúnes una cantidad para una fecha.
            Lo que apartes se descuenta del «Disponible para gastar» del Dashboard.</p>
        </div>
      )}

      {savings.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">🐷 Ahorro</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {savings.map((r) => <GoalCard key={r.goal.id} result={r} accounts={accounts} onEdit={() => openForm(r.goal.tipo, r.goal)} />)}
          </div>
        </section>
      )}

      {metas.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">🎯 Metas</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {metas.map((r) => <GoalCard key={r.goal.id} result={r} accounts={accounts} onEdit={() => openForm(r.goal.tipo, r.goal)} />)}
          </div>
        </section>
      )}
    </div>
  )
}
