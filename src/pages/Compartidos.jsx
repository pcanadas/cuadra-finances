import { useMemo, useState } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useAccountStore from '../store/useAccountStore'
import SelectSheet from '../components/SelectSheet'
import PeriodPicker from '../components/PeriodPicker'
import { useBackHandler } from '../platform/back'
import { periodLabel } from '../utils/period'
import { hasSplit } from '../utils/splits'
import { isRefund, knownPeople, makeShare, refundItems, sharedItems, sharedSummary } from '../utils/shared'

const formatEur = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const parseAmount = (s) => Number(String(s).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
const PEOPLE_LIST = 'zenit-personas'

/**
 * Gastos compartidos: gastos que pagas tú pero que en parte son de otra persona, y los reembolsos
 * que te hacen. Zenit cuenta solo tu parte (ver utils/shared.js); el movimiento no cambia.
 */
export default function Compartidos() {
  const transactions = useTransactionStore((s) => s.transactions)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const categories = useCategoryStore((s) => s.categories)
  const accounts = useAccountStore((s) => s.accounts)
  const transferCatIds = useMemo(() => new Set(categories.filter((c) => c.esTransferencia).map((c) => c.id)), [categories])
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const [period, setPeriod] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }))
  const [picking, setPicking] = useState(null) // 'gasto' | 'reembolso'
  const [editing, setEditing] = useState(null) // { kind: 'gasto', tx, part } | { kind: 'reembolso', tx }

  const years = useMemo(() => {
    const ys = new Set(transactions.map((t) => new Date(t.fechaContable).getFullYear()))
    ys.add(new Date().getFullYear())
    return [...ys].sort((a, b) => b - a)
  }, [transactions])
  const inPeriod = (iso) => {
    const d = new Date(iso)
    return d.getFullYear() === period.year && (period.month == null || d.getMonth() === period.month)
  }

  const items = useMemo(() => sharedItems(transactions).filter((it) => inPeriod(it.fecha)).sort((a, b) => b.fecha.localeCompare(a.fecha)), [transactions, period]) // eslint-disable-line react-hooks/exhaustive-deps
  const refunds = useMemo(() => refundItems(transactions).filter((r) => inPeriod(r.fecha)).sort((a, b) => b.fecha.localeCompare(a.fecha)), [transactions, period]) // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => sharedSummary(items, refunds), [items, refunds])
  const people = useMemo(() => knownPeople(transactions), [transactions])

  // Guarda el reparto de un movimiento o de una partida de su desglose (null lo quita)
  async function saveShare(tx, part, compartido, categoria) {
    if (part == null) {
      // Si estaba en una categoría de traspaso o sin categoría, se le da la del gasto para que cuente
      const cat = categoria ? { categoria, subcategoria: null, categoriaManual: true, subcategoriaManual: false } : {}
      return updateTransaction(tx.id, { compartido, ...cat })
    }
    const desglose = tx.desglose.map((p, i) => {
      if (i !== part) return p
      const { compartido: _, ...rest } = p
      return compartido ? { ...rest, compartido } : rest
    })
    return updateTransaction(tx.id, { desglose })
  }

  const empty = items.length === 0 && refunds.length === 0

  return (
    <div className="space-y-5">
      <datalist id={PEOPLE_LIST}>{people.map((n) => <option key={n} value={n} />)}</datalist>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Gastos compartidos</h1>
          <p className="text-slate-500 text-sm mt-1 max-w-2xl">
            Para los gastos que pagas tú pero que en parte son de otra persona (tu pareja, el piso, un viaje…).
            Zenit cuenta solo tu parte en tus gastos, y lo que te devuelven no cuenta como ingreso.
            Tus cuentas no cambian: siguen cuadrando con el banco.
          </p>
        </div>
        <PeriodPicker value={period} years={years} onChange={setPeriod} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setPicking('gasto')} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">👥 Compartir un gasto</button>
        <button onClick={() => setPicking('reembolso')} className="px-4 py-2 text-sm border border-indigo-200 text-indigo-600 bg-white hover:bg-indigo-50 rounded-lg">↩️ Marcar un reembolso</button>
      </div>

      {empty ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 text-sm text-slate-500 space-y-2">
          <p className="font-medium text-slate-700">No hay gastos compartidos en {periodLabel(period).toLowerCase()}.</p>
          <p>
            <strong>Compartir un gasto:</strong> elige un movimiento (por ejemplo, la compra del súper) y di qué parte es tuya:
            a medias, otro porcentaje, un importe o nada (si todo es de la otra persona).
          </p>
          <p>
            <strong>Marcar un reembolso:</strong> cuando la otra persona te devuelva su parte (un Bizum, una transferencia),
            márcalo para que no cuente como un ingreso tuyo.
          </p>
        </div>
      ) : (
        <>
          {/* Resumen del periodo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-4">
            <Stat title="Pagado por ti" value={summary.pagado} note="en gastos compartidos" tone="slate" />
            <Stat title="Tu parte" value={summary.miParte} note="lo que cuenta como gasto tuyo" tone="rose" />
            <Stat title="Has adelantado" value={summary.otros} note="la parte de los demás" tone="amber" />
            <Stat title="Te han devuelto" value={summary.devuelto} note="reembolsos" tone="emerald" />
          </div>

          {summary.personas.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 lg:p-5">
              <p className="text-sm font-semibold text-slate-700 mb-2">Por persona · {periodLabel(period)}</p>
              <ul className="divide-y divide-slate-100">
                {summary.personas.map((p) => {
                  const diff = Math.round((p.adelantado - p.devuelto) * 100) / 100
                  return (
                    <li key={p.nombre || '—'} className="py-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                      <span className="text-sm font-medium text-slate-700">{p.nombre || 'Sin indicar'}</span>
                      <span className="text-xs text-slate-500">
                        Has adelantado <strong className="text-amber-600 tabular-nums">{formatEur(p.adelantado)}</strong>
                        {' · '}te ha devuelto <strong className="text-emerald-600 tabular-nums">{formatEur(p.devuelto)}</strong>
                        {Math.abs(diff) >= 0.01 && <> · {diff > 0 ? 'falta' : 'de más'} <strong className="tabular-nums text-slate-700">{formatEur(Math.abs(diff))}</strong></>}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="text-[11px] text-slate-400 mt-2">
                Orientativo: si la otra persona también paga gastos tuyos, quién debe a quién lo sigues llevando en Splitwise o como lo hagáis.
              </p>
            </div>
          )}

          {items.length > 0 && (
            <Section title={`Gastos compartidos (${items.length})`}>
              {items.map((it) => (
                <Row key={`${it.tx.id}:${it.part ?? ''}`}
                  date={it.fecha}
                  title={it.descripcion}
                  subtitle={[it.part != null && `Partida: ${it.notas || catMap[it.categoria]?.nombre || it.part + 1}`, it.part == null && it.notas, it.con && `con ${it.con}`].filter(Boolean).join(' · ')}
                  right={<>
                    <span className="block text-sm font-semibold tabular-nums text-rose-500">{formatEur(it.miParte)}</span>
                    <span className="block text-[11px] text-slate-400 tabular-nums">tu parte de {formatEur(it.total)}</span>
                  </>}
                  onEdit={() => setEditing({ kind: 'gasto', tx: it.tx, part: it.part })} />
              ))}
            </Section>
          )}

          {refunds.length > 0 && (
            <Section title={`Reembolsos (${refunds.length})`}>
              {refunds.map((r) => (
                <Row key={r.tx.id} date={r.fecha} title={r.descripcion} subtitle={r.de && `de ${r.de}`}
                  right={<span className="text-sm font-semibold tabular-nums text-emerald-600">{formatEur(r.importe)}</span>}
                  onEdit={() => setEditing({ kind: 'reembolso', tx: r.tx })} />
              ))}
            </Section>
          )}
        </>
      )}

      {picking && (
        <TxPicker kind={picking} transactions={transactions} transferCatIds={transferCatIds} catMap={catMap} accounts={accounts}
          onClose={() => setPicking(null)}
          onPick={(tx, part) => { setPicking(null); setEditing({ kind: picking, tx, part }) }} />
      )}
      {editing?.kind === 'gasto' && (
        <ShareEditor tx={editing.tx} part={editing.part} categories={categories} transferCatIds={transferCatIds}
          onSave={async (c, categoria) => { await saveShare(editing.tx, editing.part, c, categoria); setEditing(null) }}
          onClose={() => setEditing(null)} />
      )}
      {editing?.kind === 'reembolso' && (
        <RefundEditor tx={editing.tx}
          onSave={async (r) => { await updateTransaction(editing.tx.id, { reembolso: r }); setEditing(null) }}
          onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

const TONES = {
  slate: 'bg-slate-500/10 border-slate-500/20 text-slate-600',
  rose: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
}

function Stat({ title, value, note, tone }) {
  return (
    <div className={`min-w-0 border rounded-xl p-3 lg:p-4 ${TONES[tone]}`}>
      <p className="text-[11px] uppercase font-semibold leading-tight">{title}</p>
      <p className="text-base lg:text-lg font-bold tabular-nums break-words">{formatEur(value)}</p>
      <p className="text-[11px] text-slate-500 leading-tight">{note}</p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <p className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">{title}</p>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </div>
  )
}

function Row({ date, title, subtitle, right, onEdit }) {
  return (
    <li>
      <button onClick={onEdit} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 active:bg-slate-100">
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-slate-800 truncate">{title || '—'}</span>
          <span className="block text-xs text-slate-500 truncate">{formatDate(date)}{subtitle ? ` · ${subtitle}` : ''}</span>
        </span>
        <span className="text-right shrink-0">{right}</span>
      </button>
    </li>
  )
}

function Sheet({ title, onClose, children, footer }) {
  useBackHandler(true, onClose)
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
        style={{ paddingBottom: 'var(--sab)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
          <p className="text-base font-semibold text-slate-700">{title}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 px-1" aria-label="Cerrar">✕</button>
        </div>
        <div className="overflow-y-auto px-5 pb-3 min-h-0">{children}</div>
        {footer && <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  )
}

/** Elige el movimiento (o la partida de un desglose) que se comparte o que es un reembolso. */
function TxPicker({ kind, transactions, transferCatIds, catMap, accounts, onPick, onClose }) {
  const accName = Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))
  const multiAccount = accounts.length > 1
  // Lo que se ve debajo de cada movimiento: cuenta (si hay varias) y categoría de traspaso
  const extraOf = (t, text) => [text, multiAccount && accName[t.accountId], transferCatIds.has(t.categoria) && catMap[t.categoria]?.nombre].filter(Boolean).join(' · ')
  const [q, setQ] = useState('')
  const options = useMemo(() => {
    const text = q.trim().toLowerCase()
    const list = []
    const sorted = [...transactions].sort((a, b) => b.fechaContable.localeCompare(a.fechaContable))
    for (const t of sorted) {
      // Fuera solo los traspasos emparejados entre tus cuentas; un Bizum en una categoría de
      // traspaso (p. ej. «Transferencias internas») sí puede ser un reembolso o un gasto compartido
      if (t.transferPairId) continue
      if (text && !`${t.descripcion} ${t.notas ?? ''}`.toLowerCase().includes(text)) continue
      if (kind === 'reembolso') {
        if (t.importe > 0 && !isRefund(t) && !hasSplit(t)) list.push({ tx: t, part: null, importe: t.importe, label: t.descripcion, extra: extraOf(t, t.notas) })
      } else if (t.importe < 0) {
        if (hasSplit(t)) t.desglose.forEach((p, i) => list.push({ tx: t, part: i, importe: p.importe, label: t.descripcion, extra: extraOf(t, `Partida: ${p.notas || catMap[p.categoria]?.nombre || i + 1}`), shared: !!p.compartido }))
        else list.push({ tx: t, part: null, importe: t.importe, label: t.descripcion, extra: extraOf(t, t.notas), shared: !!t.compartido })
      }
      if (list.length >= 80) break
    }
    return list
  }, [q, kind, transactions, transferCatIds, catMap]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet title={kind === 'reembolso' ? '¿Qué ingreso es un reembolso?' : '¿Qué gasto compartes?'} onClose={onClose}>
      <input type="search" autoFocus placeholder="Buscar por descripción o nota…" value={q} onChange={(e) => setQ(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-base lg:text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      {options.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">No hay {kind === 'reembolso' ? 'ingresos' : 'gastos'} que coincidan.</p>
      ) : (
        <ul className="divide-y divide-slate-100 -mx-2">
          {options.map((o) => (
            <li key={`${o.tx.id}:${o.part ?? ''}`}>
              <button onClick={() => onPick(o.tx, o.part)} className="w-full flex items-center gap-3 px-2 py-2.5 text-left rounded-lg hover:bg-slate-50 active:bg-slate-100">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-slate-800 truncate">{o.label || '—'}</span>
                  <span className="block text-xs text-slate-500 truncate">{formatDate(o.tx.fechaContable)}{o.extra ? ` · ${o.extra}` : ''}{o.shared ? ' · 👥 ya compartido' : ''}</span>
                </span>
                <span className={`text-sm font-semibold tabular-nums shrink-0 ${o.importe >= 0 ? 'text-emerald-600' : 'text-slate-700'}`}>{formatEur(o.importe)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

const MODES = [
  { id: 'mitad', label: 'A medias' },
  { id: 'pct', label: 'Otro %' },
  { id: 'importe', label: 'Un importe' },
  { id: 'nada', label: 'Nada es mío' },
]

/** Qué parte de un gasto es tuya y con quién lo compartes. */
function ShareEditor({ tx, part, categories, transferCatIds, onSave, onClose }) {
  const source = part == null ? tx : tx.desglose[part]
  // Un gasto en una categoría de traspaso o sin categoría no cuenta como gasto: hay que darle una
  const needsCategory = part == null && (!tx.categoria || transferCatIds.has(tx.categoria))
  const [categoria, setCategoria] = useState('')
  const expenseCats = categories.filter((c) => !c.esTransferencia && !c.esIngreso).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const current = source.compartido
  const total = Math.abs(source.importe)
  const [mode, setMode] = useState(() => {
    if (!current) return 'mitad'
    if (current.pct === 50) return 'mitad'
    if (current.pct === 0 || current.miParte === 0) return 'nada'
    return current.pct != null ? 'pct' : 'importe'
  })
  const [pct, setPct] = useState(current?.pct != null && current.pct !== 50 && current.pct !== 0 ? String(current.pct) : '')
  const [amount, setAmount] = useState(current?.pct == null && current?.miParte ? String(Math.abs(current.miParte)).replace('.', ',') : '')
  const [con, setCon] = useState(current?.con ?? '')

  const share = (() => {
    if (mode === 'mitad') return makeShare({ importe: source.importe, pct: 50, con })
    if (mode === 'nada') return makeShare({ importe: source.importe, pct: 0, con })
    if (mode === 'pct') { const n = parseAmount(pct); return n >= 0 && n <= 100 ? makeShare({ importe: source.importe, pct: n, con }) : null }
    const n = parseAmount(amount); return n >= 0 && n <= total ? makeShare({ importe: source.importe, miParte: n, con }) : null
  })()
  const mine = share ? Math.abs(share.miParte) : null

  return (
    <Sheet title="Gasto compartido" onClose={onClose}
      footer={<>
        {current ? <button onClick={() => onSave(null)} className="text-sm text-red-500 hover:text-red-600">Dejar de compartir</button> : <span />}
        <button disabled={!share || (needsCategory && !categoria)} onClick={() => onSave(share, needsCategory ? categoria : null)} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40">Guardar</button>
      </>}>
      <div className="rounded-xl bg-slate-50 p-3 mb-4">
        <p className="text-sm text-slate-800">{tx.descripcion}</p>
        <p className="text-xs text-slate-500">
          {formatDate(tx.fechaContable)}{part != null && ` · Partida: ${source.notas || part + 1}`} · <strong className="text-slate-700 tabular-nums">{formatEur(total)}</strong>
        </p>
      </div>

      {needsCategory && (
        <div className="mb-4">
          <p className="text-sm font-medium text-slate-700 mb-1">¿Qué tipo de gasto es?</p>
          <p className="text-xs text-slate-500 mb-2">
            {tx.categoria ? 'Está en una categoría de traspaso, que no cuenta como gasto.' : 'No tiene categoría.'} Elige la del gasto para que cuente tu parte.
          </p>
          <SelectSheet title="Categoría del gasto" value={categoria} onChange={setCategoria} className="w-full"
            options={[{ value: '', label: 'Elige una categoría…' }, ...expenseCats.map((c) => ({ value: c.id, label: c.nombre, color: c.color }))]} />
        </div>
      )}

      <p className="text-sm font-medium text-slate-700 mb-2">¿Qué parte es tuya?</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`px-2 py-2 rounded-lg border text-sm ${mode === m.id ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'pct' && (
        <label className="flex items-center gap-2 mb-3 text-sm text-slate-600">
          Tu parte:
          <input inputMode="decimal" autoFocus value={pct} onChange={(e) => setPct(e.target.value)} placeholder="25"
            className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-base lg:text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-300" /> %
        </label>
      )}
      {mode === 'importe' && (
        <label className="flex items-center gap-2 mb-3 text-sm text-slate-600">
          Tu parte:
          <input inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00"
            className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-base lg:text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-300" /> €
        </label>
      )}
      {mode === 'nada' && <p className="text-xs text-slate-500 mb-3">Todo es de la otra persona (por ejemplo, algo que le has prestado o comprado): no cuenta como gasto tuyo.</p>}

      <label className="block text-sm text-slate-600 mb-3">
        Con quién <span className="text-slate-400">(opcional)</span>
        <input list={PEOPLE_LIST} value={con} onChange={(e) => setCon(e.target.value)} placeholder="Ej: Eric"
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-base lg:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      </label>

      <p className="text-sm text-slate-600">
        {share
          ? <>Cuenta como gasto tuyo <strong className="text-rose-500 tabular-nums">{formatEur(mine)}</strong> · la otra parte <strong className="text-amber-600 tabular-nums">{formatEur(total - mine)}</strong></>
          : <span className="text-red-500">{mode === 'pct' ? 'Pon un porcentaje entre 0 y 100' : `Pon un importe entre 0 y ${formatEur(total)}`}</span>}
      </p>
    </Sheet>
  )
}

/** Un ingreso que es la devolución de un gasto compartido. */
function RefundEditor({ tx, onSave, onClose }) {
  const [de, setDe] = useState(tx.reembolso?.de ?? '')
  return (
    <Sheet title="Reembolso" onClose={onClose}
      footer={<>
        {tx.reembolso ? <button onClick={() => onSave(null)} className="text-sm text-red-500 hover:text-red-600">No es un reembolso</button> : <span />}
        <button onClick={() => onSave({ de: de.trim() })} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">Guardar</button>
      </>}>
      <div className="rounded-xl bg-slate-50 p-3 mb-4">
        <p className="text-sm text-slate-800">{tx.descripcion}</p>
        <p className="text-xs text-slate-500">{formatDate(tx.fechaContable)} · <strong className="text-emerald-600 tabular-nums">{formatEur(tx.importe)}</strong></p>
      </div>
      <p className="text-sm text-slate-600 mb-3">No contará como un ingreso tuyo: es dinero que te devuelven de un gasto compartido.</p>
      <label className="block text-sm text-slate-600">
        De quién <span className="text-slate-400">(opcional)</span>
        <input list={PEOPLE_LIST} autoFocus value={de} onChange={(e) => setDe(e.target.value)} placeholder="Ej: Eric"
          className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-base lg:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      </label>
    </Sheet>
  )
}
