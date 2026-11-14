import { useMemo, useState } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useAccountStore from '../store/useAccountStore'
import useApunteStore from '../store/useApunteStore'
import PeriodPicker from '../components/PeriodPicker'
import SelectSheet from '../components/SelectSheet'
import { useBackHandler } from '../platform/back'
import { MONTHS, periodLabel } from '../utils/period'
import { hasSplit } from '../utils/splits'
import {
  equalParts, isPayment, knownNames, ledger, makeShare, monthlyBalance, paymentOf, peopleSummary,
  shareAddsUp, shareOf, spendingByCategory,
} from '../utils/shared'

const formatEur = (v) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const parseAmount = (s) => Number(String(s).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'))
const amountText = (n) => (n ? String(Math.round(n * 100) / 100).replace('.', ',') : '')
const todayIso = () => new Date().toISOString().slice(0, 10)
const PEOPLE_LIST = 'zenit-personas'
const PARTS_LIST = 'zenit-partidas'
const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-base lg:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300'

/** «Pablo te debe 40 €», «Le debes 20 € a Pablo» o «En paz». */
function balanceText(nombre, saldo) {
  const who = nombre || 'Sin persona'
  if (Math.abs(saldo) < 0.005) return { text: nombre ? `En paz con ${who}` : 'En paz', cls: 'text-slate-500' }
  return saldo > 0
    ? { text: nombre ? `${who} te debe` : 'Te deben', cls: 'text-emerald-600' }
    : { text: nombre ? `Le debes a ${who}` : 'Debes', cls: 'text-rose-500' }
}
const partidaBalance = (saldo) => (Math.abs(saldo) < 0.005 ? 'en paz' : saldo > 0 ? `te debe ${formatEur(saldo)}` : `le debes ${formatEur(-saldo)}`)

const TIPO = {
  gasto: { label: 'Gasto compartido', cls: 'text-rose-500' },
  apunte: { label: 'Apunte', cls: 'text-slate-600' },
  recibido: { label: 'Pago recibido', cls: 'text-emerald-600' },
  enviado: { label: 'Pago que hiciste', cls: 'text-rose-500' },
}

/**
 * Gastos compartidos: las cuentas con cada persona (ver utils/shared.js). El histórico completo por
 * defecto: las deudas no caducan, se van compensando.
 */
export default function Compartidos() {
  const transactions = useTransactionStore((s) => s.transactions)
  const updateTransaction = useTransactionStore((s) => s.updateTransaction)
  const categories = useCategoryStore((s) => s.categories)
  const accounts = useAccountStore((s) => s.accounts)
  const { apuntes, addApunte, updateApunte, deleteApunte } = useApunteStore()
  const transferCatIds = useMemo(() => new Set(categories.filter((c) => c.esTransferencia).map((c) => c.id)), [categories])
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const [period, setPeriod] = useState(null) // null = todo el histórico
  const [detail, setDetail] = useState(null) // nombre de la persona abierta (o '' sin persona)
  const [picking, setPicking] = useState(null) // { kind: 'gasto'|'recibido'|'enviado', persona }
  const [editing, setEditing] = useState(null)
  useBackHandler(detail != null, () => setDetail(null))

  const allEntries = useMemo(() => ledger(transactions, apuntes), [transactions, apuntes])
  const names = useMemo(() => knownNames(allEntries), [allEntries])
  const entries = useMemo(() => (period == null ? allEntries : allEntries.filter((e) => {
    const d = new Date(e.fecha)
    return d.getFullYear() === period.year && (period.month == null || d.getMonth() === period.month)
  })), [allEntries, period])
  const people = useMemo(() => peopleSummary(entries), [entries])
  const years = useMemo(() => {
    const ys = new Set(allEntries.map((e) => new Date(e.fecha).getFullYear()))
    ys.add(new Date().getFullYear())
    return [...ys].sort((a, b) => b - a)
  }, [allEntries])

  // ── guardar ──
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
  const savePayment = (tx, pagoPersona) => updateTransaction(tx.id, { pagoPersona, reembolso: null })
  // Abrir el editor de un apunte del libro
  const openEntry = (e) => {
    if (e.ref.kind === 'apunte') return setEditing({ kind: 'apunte', apunte: e.ref.apunte })
    if (e.tipo === 'recibido' || e.tipo === 'enviado') return setEditing({ kind: 'pago', tx: e.ref.tx })
    setEditing({ kind: 'gasto', tx: e.ref.tx, part: e.ref.part })
  }

  const actions = (persona) => (
    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
      <button onClick={() => setPicking({ kind: 'gasto', persona })} className="px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">👥 Gasto compartido</button>
      <button onClick={() => setEditing({ kind: 'apunte', apunte: null, persona })} className="px-3 py-2 text-sm border border-indigo-200 text-indigo-600 bg-white hover:bg-indigo-50 rounded-lg">✍️ Apunte sin movimiento</button>
      <button onClick={() => setPicking({ kind: 'recibido', persona })} className="px-3 py-2 text-sm border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 rounded-lg">🟢 Pago recibido</button>
      <button onClick={() => setPicking({ kind: 'enviado', persona })} className="px-3 py-2 text-sm border border-sky-200 text-sky-700 bg-white hover:bg-sky-50 rounded-lg">🔵 Pago que haces</button>
    </div>
  )

  const periodFilter = (
    <div className="flex flex-wrap items-center gap-2">
      {period == null ? (
        <>
          <span className="text-xs font-medium text-slate-500 px-2.5 py-1 rounded-full bg-slate-100">Todo el histórico</span>
          <button onClick={() => setPeriod({ year: new Date().getFullYear(), month: new Date().getMonth() })}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">Filtrar por fecha</button>
        </>
      ) : (
        <>
          <PeriodPicker value={period} years={years} onChange={setPeriod} />
          <button onClick={() => setPeriod(null)} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">✕ Todo el histórico</button>
        </>
      )}
    </div>
  )

  const person = detail != null ? people.find((p) => p.nombre === detail) ?? { nombre: detail, saldo: 0, adelantado: 0, debido: 0, recibido: 0, enviado: 0, partidas: [], n: 0 } : null

  return (
    <div className="space-y-5">
      <datalist id={PEOPLE_LIST}>{names.personas.map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id={PARTS_LIST}>{names.partidas.map((n) => <option key={n} value={n} />)}</datalist>

      {person ? (
        <PersonDetail person={person} entries={entries.filter((e) => e.persona === detail)} catMap={catMap}
          periodFilter={periodFilter} period={period} actions={actions(detail)} onBack={() => setDetail(null)} onOpen={openEntry} />
      ) : (
        <>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Gastos compartidos</h1>
            <p className="text-slate-500 text-sm mt-1 max-w-3xl">
              Las cuentas con cada persona: lo que pagas por otros, lo que pagan por ti y lo que os vais devolviendo.
              Zenit cuenta solo tu parte de cada gasto, y los pagos entre vosotros no son ingresos ni gastos tuyos.
              Tus cuentas no cambian: siguen cuadrando con el banco.
            </p>
          </div>
          {actions('')}
          {periodFilter}

          {people.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 text-sm text-slate-600 space-y-2">
              <p className="font-medium text-slate-700">{period == null ? 'Aún no hay nada compartido.' : `Nada compartido en ${periodLabel(period).toLowerCase()}.`}</p>
              <p><strong>👥 Gasto compartido:</strong> un gasto de tu banco que en parte es de otras personas (la compra, un hotel…). Dices qué parte es tuya y la de cada una.</p>
              <p><strong>✍️ Apunte sin movimiento:</strong> algo que pagó otra persona (te invitó a la cena, te prestó dinero) o que pagaste tú en efectivo.</p>
              <p><strong>🟢 Pago recibido / 🔵 Pago que haces:</strong> un Bizum o una transferencia entre vosotros para ir saldando.</p>
              <p>Cada apunte puede ir en una <strong>partida</strong> (un viaje, un regalo…) para llevar cuentas separadas con la misma persona.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {people.map((p) => <PersonCard key={p.nombre || '—'} person={p} onOpen={() => setDetail(p.nombre)} />)}
            </div>
          )}
        </>
      )}

      {picking && (
        <TxPicker kind={picking.kind} transactions={transactions} transferCatIds={transferCatIds} catMap={catMap} accounts={accounts}
          onClose={() => setPicking(null)}
          onPick={(tx, part) => {
            const persona = picking.persona
            setPicking(null)
            setEditing(picking.kind === 'gasto' ? { kind: 'gasto', tx, part, persona } : { kind: 'pago', tx, persona })
          }} />
      )}
      {editing?.kind === 'gasto' && (
        <ShareEditor tx={editing.tx} part={editing.part} persona={editing.persona} categories={categories} transferCatIds={transferCatIds}
          onSave={async (c, categoria) => { await saveShare(editing.tx, editing.part, c, categoria); setEditing(null) }}
          onClose={() => setEditing(null)} />
      )}
      {editing?.kind === 'apunte' && (
        <ShareEditor apunte={editing.apunte} persona={editing.persona} categories={categories} transferCatIds={transferCatIds}
          onSave={async (a) => { if (editing.apunte) await updateApunte(editing.apunte.id, a); else await addApunte(a); setEditing(null) }}
          onDelete={editing.apunte ? async () => { await deleteApunte(editing.apunte.id); setEditing(null) } : null}
          onClose={() => setEditing(null)} />
      )}
      {editing?.kind === 'pago' && (
        <PaymentEditor tx={editing.tx} persona={editing.persona}
          onSave={async (p) => { await savePayment(editing.tx, p); setEditing(null) }}
          onClose={() => setEditing(null)} />
      )}
    </div>
  )
}

// ─── Tarjetas y detalle ────────────────────────────────────────────────────────

function PersonCard({ person: p, onOpen }) {
  const b = balanceText(p.nombre, p.saldo)
  const partidas = p.partidas.filter((x) => x.nombre)
  return (
    <button onClick={onOpen} className="text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-indigo-200 hover:shadow transition">
      <p className="text-base font-semibold text-slate-800">{p.nombre || 'Sin persona'}</p>
      <p className={`text-sm mt-1 ${b.cls}`}>{b.text}</p>
      {Math.abs(p.saldo) >= 0.005 && <p className={`text-2xl font-bold tabular-nums ${b.cls}`}>{formatEur(Math.abs(p.saldo))}</p>}
      {partidas.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {p.partidas.map((x) => (
            <li key={x.nombre || '—'} className="flex items-baseline justify-between gap-3 py-1.5 text-xs">
              <span className="text-slate-600 truncate">{x.nombre || 'Sin partida'}</span>
              <span className={`tabular-nums whitespace-nowrap ${x.saldo > 0.005 ? 'text-emerald-600' : x.saldo < -0.005 ? 'text-rose-500' : 'text-slate-400'}`}>{partidaBalance(x.saldo)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-indigo-500 font-medium mt-3">Ver detalles · {p.n} {p.n === 1 ? 'apunte' : 'apuntes'} →</p>
    </button>
  )
}

function PersonDetail({ person, entries, catMap, periodFilter, period, actions, onBack, onOpen }) {
  const [partida, setPartida] = useState(null) // null = todas
  const shown = partida == null ? entries : entries.filter((e) => e.partida === partida)
  const summary = peopleSummary(shown)[0] ?? { saldo: 0, adelantado: 0, debido: 0, recibido: 0, enviado: 0 }
  const months = monthlyBalance(shown).reverse()
  const cats = spendingByCategory(shown)
  const maxCat = Math.max(1, ...cats.map((c) => c.total))
  const b = balanceText(person.nombre, summary.saldo)

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-indigo-600 font-medium">← Todas las personas</button>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-800">{person.nombre || 'Sin persona'}</h1>
            <p className={`text-sm mt-1 ${b.cls}`}>{b.text}{partida != null && ` · ${partida || 'sin partida'}`}{period != null && ` · ${periodLabel(period).toLowerCase()}`}</p>
            {Math.abs(summary.saldo) >= 0.005 && <p className={`text-3xl font-bold tabular-nums ${b.cls}`}>{formatEur(Math.abs(summary.saldo))}</p>}
          </div>
          {periodFilter}
        </div>

        {person.partidas.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {[null, ...person.partidas.map((x) => x.nombre)].map((x) => (
              <button key={x ?? '__all'} onClick={() => setPartida(x)}
                className={`text-xs px-2.5 py-1 rounded-full border ${partida === x ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {x == null ? 'Todas las partidas' : x || 'Sin partida'}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 mt-4">
          <Total label={`Pagaste por ${person.nombre || 'otros'}`} value={summary.adelantado} cls="text-emerald-600" />
          <Total label="Pagó por ti" value={summary.debido} cls="text-rose-500" />
          <Total label="Te ha pagado" value={summary.recibido} cls="text-rose-500" note="resta de lo que te debe" />
          <Total label="Le has pagado" value={summary.enviado} cls="text-emerald-600" note="resta de lo que le debes" />
        </div>
      </div>

      {actions}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Saldo mes a mes">
          {months.length === 0 ? <p className="text-sm text-slate-400 px-4 py-3">Sin apuntes.</p> : (
            <ul className="divide-y divide-slate-100">
              {months.map((m) => (
                <li key={m.mes} className="flex items-baseline justify-between gap-3 px-4 py-2 text-sm">
                  <span className="text-slate-600">{MONTHS[Number(m.mes.slice(5, 7)) - 1]} {m.mes.slice(0, 4)}</span>
                  <span className="text-right">
                    <span className={`tabular-nums text-xs mr-2 ${m.cambio >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{m.cambio >= 0 ? '+' : '−'}{formatEur(Math.abs(m.cambio))}</span>
                    <span className={`tabular-nums font-semibold ${m.saldo > 0.005 ? 'text-emerald-600' : m.saldo < -0.005 ? 'text-rose-500' : 'text-slate-500'}`}>{partidaBalance(m.saldo)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Gastos por categoría">
          {cats.length === 0 ? <p className="text-sm text-slate-400 px-4 py-3">Sin gastos compartidos.</p> : (
            <ul className="divide-y divide-slate-100">
              {cats.map((c) => {
                const cat = catMap[c.categoria]
                return (
                  <li key={c.categoria ?? '—'} className="px-4 py-2">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 min-w-0 text-slate-700">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat?.color ?? '#94a3b8' }} />
                        <span className="truncate">{cat?.nombre ?? 'Sin categoría'}</span>
                      </span>
                      <span className="tabular-nums text-slate-700 whitespace-nowrap">{formatEur(c.total)} <span className="text-xs text-slate-400">· su parte {formatEur(c.suParte)}</span></span>
                    </div>
                    <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(c.total / maxCat) * 100}%`, backgroundColor: cat?.color ?? '#94a3b8' }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={`Apuntes (${shown.length})`}>
        <ul className="divide-y divide-slate-100">
          {shown.map((e) => <EntryRow key={e.key} e={e} onOpen={() => onOpen(e)} />)}
        </ul>
      </Panel>
    </div>
  )
}

function Total({ label, value, cls, note }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 min-w-0">
      <p className="text-[11px] uppercase font-semibold text-slate-500 leading-tight">{label}</p>
      <p className={`text-base lg:text-lg font-bold tabular-nums ${cls}`}>{formatEur(value)}</p>
      {note && <p className="text-[11px] text-slate-400 leading-tight">{note}</p>}
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <p className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">{title}</p>
      {children}
    </div>
  )
}

/** Un apunte: el movimiento en verde (entra) o rojo (sale) y lo que cambia la deuda. */
function EntryRow({ e, onOpen }) {
  const t = TIPO[e.tipo]
  const effect = e.efecto >= 0 ? `te debe ${formatEur(e.efecto)}` : `le debes ${formatEur(-e.efecto)}`
  const detail = e.tipo === 'gasto' ? `tu parte ${formatEur(e.miParte)} · ${effect}`
    : e.tipo === 'apunte' ? (e.efecto < 0 ? `pagó ${formatEur(e.total)} · tu parte ${formatEur(e.miParte)}` : `pagaste ${formatEur(e.total)} · ${effect}`)
    : e.tipo === 'recibido' ? 'salda lo que te debe' : 'salda lo que le debes'
  const amount = e.tipo === 'recibido' ? e.total : e.tipo === 'apunte' ? e.efecto : -e.total
  return (
    <li>
      <button onClick={onOpen} className="w-full flex items-start gap-3 px-4 py-2.5 text-left hover:bg-slate-50 active:bg-slate-100">
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-slate-800 truncate">{e.descripcion || '—'}</span>
          {e.nota && <span className="block text-xs italic text-slate-500 truncate">{e.nota}</span>}
          <span className="block text-xs text-slate-500">
            {formatDate(e.fecha)} · <span className={t.cls}>{t.label}</span>{e.partida && <> · <span className="text-indigo-500">{e.partida}</span></>}
          </span>
          <span className="block text-[11px] text-slate-400">{detail}</span>
        </span>
        <span className={`shrink-0 text-sm font-semibold tabular-nums ${amount >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{amount >= 0 ? '+' : '−'}{formatEur(Math.abs(amount))}</span>
      </button>
    </li>
  )
}

// ─── Hojas ─────────────────────────────────────────────────────────────────────

function Sheet({ title, onClose, children, footer, top }) {
  useBackHandler(true, onClose)
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col"
        style={{ paddingBottom: 'var(--sab)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
          <p className="text-base font-semibold text-slate-700">{title}</p>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 px-1" aria-label="Cerrar">✕</button>
        </div>
        {top && <div className="px-5 pt-1 pb-2">{top}</div>}
        <div className="overflow-y-auto px-5 pt-1 pb-3 min-h-0">{children}</div>
        {footer && <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  )
}

const PICK_TITLE = { gasto: '¿Qué gasto compartes?', recibido: '¿Qué pago has recibido?', enviado: '¿Qué pago has hecho?' }

/** Elige el movimiento (o la partida de un desglose). Fuera solo los traspasos entre tus cuentas. */
function TxPicker({ kind, transactions, transferCatIds, catMap, accounts, onPick, onClose }) {
  const [q, setQ] = useState('')
  const accName = Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))
  const multiAccount = accounts.length > 1
  const extraOf = (t, text) => [text, multiAccount && accName[t.accountId], transferCatIds.has(t.categoria) && catMap[t.categoria]?.nombre].filter(Boolean).join(' · ')
  const options = useMemo(() => {
    const text = q.trim().toLowerCase()
    const list = []
    const sorted = [...transactions].sort((a, b) => String(b.fechaContable).localeCompare(String(a.fechaContable)))
    for (const t of sorted) {
      // Un Bizum en «Transferencias internas» sí puede ser un pago o un gasto compartido
      if (t.transferPairId) continue
      if (text && !`${t.descripcion} ${t.notas ?? ''}`.toLowerCase().includes(text)) continue
      if (kind === 'gasto') {
        if (t.importe >= 0 || isPayment(t)) continue
        if (hasSplit(t)) t.desglose.forEach((p, i) => list.push({ tx: t, part: i, importe: p.importe, extra: extraOf(t, `Partida: ${p.notas || catMap[p.categoria]?.nombre || i + 1}`), marked: !!p.compartido }))
        else list.push({ tx: t, part: null, importe: t.importe, extra: extraOf(t, t.notas), marked: !!t.compartido })
      } else {
        if ((kind === 'recibido') !== (t.importe > 0) || hasSplit(t) || t.compartido) continue
        list.push({ tx: t, part: null, importe: t.importe, extra: extraOf(t, t.notas), marked: isPayment(t) })
      }
      if (list.length >= 80) break
    }
    return list
  }, [q, kind, transactions, transferCatIds, catMap]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet title={PICK_TITLE[kind]} onClose={onClose}
      top={<input type="search" autoFocus placeholder="Buscar por descripción o nota…" value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} />}>
      {options.length === 0 ? (
        <p className="text-sm text-slate-400 py-4 text-center">No hay movimientos que coincidan.</p>
      ) : (
        <ul className="divide-y divide-slate-100 -mx-2">
          {options.map((o) => (
            <li key={`${o.tx.id}:${o.part ?? ''}`}>
              <button onClick={() => onPick(o.tx, o.part)} className="w-full flex items-center gap-3 px-2 py-2.5 text-left rounded-lg hover:bg-slate-50 active:bg-slate-100">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-slate-800 truncate">{o.tx.descripcion || '—'}</span>
                  <span className="block text-xs text-slate-500 truncate">{formatDate(o.tx.fechaContable)}{o.extra ? ` · ${o.extra}` : ''}{o.marked ? ' · ya apuntado' : ''}</span>
                </span>
                <span className={`text-sm font-semibold tabular-nums shrink-0 ${o.importe >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{formatEur(o.importe)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}

/** Partida y nota, comunes a todos los editores. */
function PartidaNota({ partida, setPartida, nota, setNota }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3 mb-3">
      <label className="block text-sm text-slate-600">
        Partida <span className="text-slate-400">(opcional)</span>
        <input list={PARTS_LIST} value={partida} onChange={(e) => setPartida(e.target.value)} placeholder="Ej: Viaje a Lisboa" className={`mt-1 ${inputCls}`} />
      </label>
      <label className="block text-sm text-slate-600">
        Nota <span className="text-slate-400">(opcional)</span>
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Para recordar por qué" className={`mt-1 ${inputCls}`} />
      </label>
    </div>
  )
}

const MODES_YO = [
  { id: 'iguales', label: 'A partes iguales' },
  { id: 'pct', label: 'Tu %' },
  { id: 'importe', label: 'Tu importe' },
  { id: 'nada', label: 'Nada es tuyo' },
]
const MODES_OTRO = [
  { id: 'iguales', label: 'A medias' },
  { id: 'pct', label: 'Tu %' },
  { id: 'importe', label: 'Tu importe' },
  { id: 'todo', label: 'Todo es tuyo' },
]

/**
 * Gasto compartido de un movimiento (o partida) o apunte sin movimiento: quién pagó, qué parte es
 * tuya, la de cada persona, la categoría (para que tu parte cuente como gasto), partida y nota.
 */
function ShareEditor({ tx, part, apunte, persona, categories, transferCatIds, onSave, onDelete, onClose }) {
  const isApunte = !tx
  const source = isApunte ? null : part == null ? tx : tx.desglose[part]
  const current = source ? shareOf(source) : null
  const [fecha, setFecha] = useState(apunte?.fecha ?? todayIso())
  const [descripcion, setDescripcion] = useState(apunte?.descripcion ?? '')
  const [importeText, setImporteText] = useState(amountText(apunte?.importe))
  const [pagadoPor, setPagadoPor] = useState(apunte ? apunte.pagadoPor ?? '' : persona ?? '')
  const [paidByOther, setPaidByOther] = useState(apunte ? !!apunte.pagadoPor : isApunte && !!persona)
  const total = isApunte ? (parseAmount(importeText) || 0) : Math.abs(source.importe)

  const initialPeople = current ? current.personas.map((p) => p.nombre).filter(Boolean)
    : apunte && !apunte.pagadoPor ? (apunte.personas ?? []).map((p) => p.nombre)
    : persona ? [persona] : []
  const [people, setPeople] = useState(initialPeople)
  const [newPerson, setNewPerson] = useState('')
  const initialMine = isApunte ? apunte?.miParte ?? 0 : current ? Math.abs(current.miParte) : 0
  const [mode, setMode] = useState(() => {
    if (!current && !apunte) return 'iguales'
    if (apunte?.pagadoPor && apunte.miParte >= apunte.importe) return 'todo'
    const pct = current?.pct
    if (pct === 0 || (initialMine === 0)) return 'nada'
    if (pct === 50 && initialPeople.length <= 1) return 'iguales'
    return pct != null ? 'pct' : 'importe'
  })
  const [pct, setPct] = useState(current?.pct != null && ![0, 50].includes(current.pct) ? String(current.pct) : '')
  const [mineText, setMineText] = useState(amountText(initialMine))
  const [manual, setManual] = useState(false)
  const [manualAmounts, setManualAmounts] = useState(() => (current ? current.personas.map((p) => amountText(p.importe)) : (apunte?.personas ?? []).map((p) => amountText(p.importe))))
  const [partida, setPartida] = useState(current?.partida ?? apunte?.partida ?? '')
  const [nota, setNota] = useState(current?.nota ?? apunte?.nota ?? '')
  const needsCategory = !isApunte && part == null && (!tx.categoria || transferCatIds.has(tx.categoria))
  const [categoria, setCategoria] = useState(apunte?.categoria ?? '')
  const expenseCats = categories.filter((c) => !c.esTransferencia && !c.esIngreso).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const byOther = isApunte && paidByOther
  const modes = byOther ? MODES_OTRO : MODES_YO
  const sign = isApunte ? -1 : Math.sign(source.importe) || -1

  // Tu parte según el modo
  let mine = null
  if (mode === 'iguales') mine = byOther ? equalParts(total, 2)[0] : equalParts(total, people.length + 1)[0]
  else if (mode === 'pct') { const n = parseAmount(pct); mine = n >= 0 && n <= 100 ? Math.round(total * n) / 100 : null }
  else if (mode === 'importe') { const n = parseAmount(mineText); mine = n >= 0 && n <= total ? n : null }
  else if (mode === 'nada') mine = 0
  else if (mode === 'todo') mine = total

  // Reparto entre las personas (si pagaste tú)
  let share = null, error = null
  if (!(total > 0)) error = isApunte ? 'Pon el importe total' : null
  else if (mine == null) error = mode === 'pct' ? 'Pon un porcentaje entre 0 y 100' : `Tu parte debe estar entre 0 y ${formatEur(total)}`
  else if (byOther) {
    if (!pagadoPor.trim()) error = '¿Quién lo pagó?'
  } else {
    if (!people.length) error = 'Añade al menos una persona'
    else {
      const otros = manual ? manualAmounts.map((a) => parseAmount(a) || 0) : null
      share = makeShare({ importe: sign * total, modo: 'importe', miParte: mine, nombres: people, otros, partida, nota })
      share.pct = mode === 'pct' ? parseAmount(pct) : mode === 'iguales' && people.length === 1 ? 50 : mode === 'nada' ? 0 : null
      if (!shareAddsUp(share, sign * total)) error = `Las partes deben sumar ${formatEur(total)}`
    }
  }
  if (!error && needsCategory && !categoria) error = 'Elige la categoría del gasto'
  if (!error && isApunte && !descripcion.trim()) error = 'Pon una descripción'

  const addPerson = () => {
    const n = newPerson.trim()
    if (n && !people.includes(n)) { setPeople([...people, n]); setManualAmounts([...manualAmounts, '']) }
    setNewPerson('')
  }
  const removePerson = (i) => { setPeople(people.filter((_, j) => j !== i)); setManualAmounts(manualAmounts.filter((_, j) => j !== i)) }
  const autoAmounts = mine != null && people.length ? equalParts(Math.max(0, total - mine), people.length) : []

  function save() {
    if (error) return
    if (!isApunte) return onSave(share, needsCategory ? categoria : null)
    onSave({
      fecha, descripcion: descripcion.trim(), importe: total,
      pagadoPor: byOther ? pagadoPor.trim() : '',
      miParte: mine,
      personas: byOther ? [] : share.personas,
      categoria: categoria || null, subcategoria: null,
      partida: partida.trim(), nota: nota.trim(),
    })
  }

  return (
    <Sheet title={isApunte ? (apunte ? 'Apunte sin movimiento' : 'Nuevo apunte sin movimiento') : 'Gasto compartido'} onClose={onClose}
      footer={<>
        {isApunte
          ? (onDelete ? <button onClick={onDelete} className="text-sm text-red-500 hover:text-red-600">Borrar apunte</button> : <span />)
          : (current ? <button onClick={() => onSave(null)} className="text-sm text-red-500 hover:text-red-600">Dejar de compartir</button> : <span />)}
        <button disabled={!!error} onClick={save} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40">Guardar</button>
      </>}>
      {isApunte ? (
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-2">
            {[[false, 'Lo pagué yo'], [true, 'Lo pagó otra persona']].map(([v, label]) => (
              <button key={label} onClick={() => { setPaidByOther(v); setMode('iguales') }}
                className={`px-2 py-2 rounded-lg border text-sm ${paidByOther === v ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{label}</button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {paidByOther ? 'Por ejemplo, te invitó a la cena o te prestó dinero: le debes tu parte.' : 'Algo que pagaste fuera de tus cuentas (en efectivo, con otra tarjeta…): te deben su parte.'}
          </p>
          {paidByOther && (
            <label className="block text-sm text-slate-600">¿Quién?
              <input list={PEOPLE_LIST} value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)} placeholder="Ej: Pablo" className={`mt-1 ${inputCls}`} />
            </label>
          )}
          <label className="block text-sm text-slate-600">Descripción
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Cena en La Plaza" className={`mt-1 ${inputCls}`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-slate-600">Fecha
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`mt-1 ${inputCls}`} />
            </label>
            <label className="block text-sm text-slate-600">Importe total
              <input inputMode="decimal" value={importeText} onChange={(e) => setImporteText(e.target.value)} placeholder="0,00" className={`mt-1 ${inputCls} text-right`} />
            </label>
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 p-3 mb-4">
          <p className="text-sm text-slate-800">{tx.descripcion}</p>
          <p className="text-xs text-slate-500">
            {formatDate(tx.fechaContable)}{part != null && ` · Partida del desglose: ${source.notas || part + 1}`} · <strong className="text-slate-700 tabular-nums">{formatEur(total)}</strong>
          </p>
        </div>
      )}

      {!byOther && (
        <div className="mb-4">
          <p className="text-sm font-medium text-slate-700 mb-2">¿Con quién lo compartes?</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {people.map((n, i) => (
              <span key={n} className="inline-flex items-center gap-1 text-sm pl-2.5 pr-1 py-1 rounded-full bg-indigo-50 text-indigo-700">
                {n}
                <button onClick={() => removePerson(i)} className="w-5 h-5 rounded-full text-indigo-400 hover:text-red-500" aria-label={`Quitar a ${n}`}>✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input list={PEOPLE_LIST} value={newPerson} onChange={(e) => setNewPerson(e.target.value)} placeholder="Ej: Pablo"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPerson() } }} className={inputCls} />
            <button onClick={addPerson} disabled={!newPerson.trim()} className="px-3 py-2 text-sm rounded-lg border border-indigo-200 text-indigo-600 disabled:opacity-40 whitespace-nowrap">+ Añadir</button>
          </div>
        </div>
      )}

      <p className="text-sm font-medium text-slate-700 mb-2">¿Qué parte es tuya?</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {modes.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`px-2 py-2 rounded-lg border text-sm ${mode === m.id ? 'border-indigo-400 bg-indigo-50 text-indigo-700 font-medium' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{m.label}</button>
        ))}
      </div>
      {mode === 'pct' && (
        <label className="flex items-center gap-2 mb-3 text-sm text-slate-600">Tu parte:
          <input inputMode="decimal" autoFocus value={pct} onChange={(e) => setPct(e.target.value)} placeholder="25" className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-base lg:text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-300" /> %
        </label>
      )}
      {mode === 'importe' && (
        <label className="flex items-center gap-2 mb-3 text-sm text-slate-600">Tu parte:
          <input inputMode="decimal" autoFocus value={mineText} onChange={(e) => setMineText(e.target.value)} placeholder="0,00" className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-base lg:text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-300" /> €
        </label>
      )}

      {!byOther && people.length > 0 && mine != null && (
        <div className="rounded-xl border border-slate-200 p-3 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold uppercase text-slate-500">Lo que te debe cada persona</p>
            {people.length > 1 && (
              <button onClick={() => { setManual(!manual); setManualAmounts(autoAmounts.map(amountText)) }} className="text-xs text-indigo-500 hover:text-indigo-700">
                {manual ? 'A partes iguales' : 'Ajustar a mano'}
              </button>
            )}
          </div>
          <ul className="space-y-1">
            {people.map((n, i) => (
              <li key={n} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700 truncate">{n}</span>
                {manual ? (
                  <input inputMode="decimal" value={manualAmounts[i] ?? ''} onChange={(e) => setManualAmounts(manualAmounts.map((a, j) => (j === i ? e.target.value : a)))}
                    className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-base lg:text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                ) : <span className="tabular-nums text-amber-600 font-medium">{formatEur(autoAmounts[i] ?? 0)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(needsCategory || isApunte) && (
        <div className="mb-3">
          <p className="text-sm font-medium text-slate-700 mb-1">{isApunte ? '¿Cuenta tu parte como gasto tuyo?' : '¿Qué tipo de gasto es?'}</p>
          <p className="text-xs text-slate-500 mb-2">
            {isApunte ? 'Elige la categoría para que tu parte cuente en tus gastos ese día. Si es un préstamo, déjalo sin categoría.'
              : `${tx.categoria ? 'Está en una categoría de traspaso, que no cuenta como gasto.' : 'No tiene categoría.'} Elige la del gasto para que cuente tu parte.`}
          </p>
          <SelectSheet title="Categoría" value={categoria} onChange={setCategoria} className="w-full"
            options={[{ value: '', label: isApunte ? '— No es un gasto mío (préstamo, deuda) —' : 'Elige una categoría…' }, ...expenseCats.map((c) => ({ value: c.id, label: c.nombre, color: c.color }))]} />
        </div>
      )}

      <PartidaNota partida={partida} setPartida={setPartida} nota={nota} setNota={setNota} />

      <p className="text-sm text-slate-600">
        {error ? <span className="text-red-500">{error}</span>
          : byOther ? <>Le debes a {pagadoPor.trim()} <strong className="text-rose-500 tabular-nums">{formatEur(mine)}</strong>{categoria && <> · cuenta como gasto tuyo</>}</>
          : <>Tu parte <strong className="text-rose-500 tabular-nums">{formatEur(mine)}</strong> · te deben <strong className="text-emerald-600 tabular-nums">{formatEur(total - mine)}</strong></>}
      </p>
    </Sheet>
  )
}

/** Un pago entre personas (Bizum, transferencia): de quién o a quién, partida y nota. */
function PaymentEditor({ tx, persona, onSave, onClose }) {
  const current = paymentOf(tx)
  const sentido = tx.importe > 0 ? 'recibido' : 'enviado'
  const [who, setWho] = useState(current?.persona ?? persona ?? '')
  const [partida, setPartida] = useState(current?.partida ?? '')
  const [nota, setNota] = useState(current?.nota ?? '')
  return (
    <Sheet title={sentido === 'recibido' ? 'Pago recibido' : 'Pago que haces'} onClose={onClose}
      footer={<>
        {current ? <button onClick={() => onSave(null)} className="text-sm text-red-500 hover:text-red-600">No es un pago entre personas</button> : <span />}
        <button disabled={!who.trim()} onClick={() => onSave({ persona: who.trim(), sentido, partida: partida.trim(), nota: nota.trim() })}
          className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-40">Guardar</button>
      </>}>
      <div className="rounded-xl bg-slate-50 p-3 mb-4">
        <p className="text-sm text-slate-800">{tx.descripcion}</p>
        <p className="text-xs text-slate-500">{formatDate(tx.fechaContable)} · <strong className={`tabular-nums ${tx.importe > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{formatEur(tx.importe)}</strong></p>
      </div>
      <p className="text-sm text-slate-600 mb-3">
        {sentido === 'recibido'
          ? 'Te devuelve lo que te debe (o te presta): no cuenta como un ingreso tuyo.'
          : 'Le pagas lo que le debes (o le prestas): no cuenta como un gasto tuyo.'}
      </p>
      <label className="block text-sm text-slate-600 mb-3">{sentido === 'recibido' ? '¿De quién?' : '¿A quién?'}
        <input list={PEOPLE_LIST} autoFocus value={who} onChange={(e) => setWho(e.target.value)} placeholder="Ej: Pablo" className={`mt-1 ${inputCls}`} />
      </label>
      <PartidaNota partida={partida} setPartida={setPartida} nota={nota} setNota={setNota} />
    </Sheet>
  )
}
