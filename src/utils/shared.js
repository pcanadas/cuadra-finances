/**
 * Gastos compartidos (sección «Compartidos»): las cuentas con cada persona —quién debe a quién— y
 * la parte de cada gasto que es de verdad tuya.
 *
 * Hay cuatro tipos de apunte, y cada uno puede llevar una partida (un viaje, un regalo…) y una nota:
 * - Gasto compartido: un movimiento del banco —o una partida de su desglose, ver splits.js— con
 *   `compartido: { miParte, pct, personas: [{ nombre, importe }], partida, nota }`. `miParte` con
 *   el signo del movimiento (0 si nada es tuyo), `pct` el porcentaje elegido (null si no) y en
 *   `personas` lo que corresponde a cada una (en positivo): eso te lo deben.
 * - Pago recibido o pago que haces: un movimiento del banco con
 *   `pagoPersona: { persona, sentido: 'recibido'|'enviado', partida, nota }`. Salda (o crea) deuda:
 *   no es un ingreso ni un gasto tuyo.
 * - Apunte sin movimiento (tabla `apuntes`, ver useApunteStore): algo que pagó otra persona
 *   (`pagadoPor`: le debes `miParte`) o que pagaste tú fuera de tus cuentas (`pagadoPor: ''`: cada
 *   una de `personas` te debe su parte). Con `categoria`, tu parte cuenta como gasto tuyo ese día.
 *
 * El movimiento no cambia (sigue cuadrando con el banco): `forStats` da la vista para las
 * estadísticas, con las partidas desglosadas, solo tu parte de cada gasto, sin los pagos entre
 * personas y con tu parte de los apuntes.
 *
 * Saldo con una persona: positivo, te debe; negativo, le debes.
 */
import { expandSplits, hasSplit } from './splits'

const round2 = (n) => Math.round(n * 100) / 100
const cents = (n) => Math.round(n * 100)
const clean = (s) => String(s ?? '').trim()

// ─── Lectura (también del formato de la primera prueba: `con` y `reembolso`) ──────────────────

/** Reparto normalizado de un movimiento o partida, o null. */
export function shareOf(p) {
  const c = p?.compartido
  if (!c) return null
  const personas = Array.isArray(c.personas) ? c.personas
    : [{ nombre: clean(c.con), importe: round2(Math.abs(p.importe) - Math.abs(c.miParte)) }]
  return { miParte: c.miParte, pct: c.pct ?? null, personas: personas.filter((x) => x.importe > 0 || x.nombre), partida: clean(c.partida), nota: clean(c.nota) }
}

/** Pago entre personas de un movimiento, o null. */
export function paymentOf(t) {
  if (t?.pagoPersona) return { persona: clean(t.pagoPersona.persona), sentido: t.pagoPersona.sentido, partida: clean(t.pagoPersona.partida), nota: clean(t.pagoPersona.nota) }
  if (t?.reembolso) return { persona: clean(t.reembolso.de), sentido: 'recibido', partida: '', nota: '' }
  return null
}

export const isPayment = (t) => !!paymentOf(t)
export const isSharedTx = (t) => !!t?.compartido || (hasSplit(t) && t.desglose.some((p) => p.compartido))

// ─── Repartos ─────────────────────────────────────────────────────────────────

/** Reparte `total` (en positivo) a partes iguales entre `n`, cuadrando los céntimos en la última. */
export function equalParts(total, n) {
  if (n <= 0) return []
  const each = Math.floor(cents(total) / n)
  const parts = Array.from({ length: n }, () => each)
  parts[n - 1] += cents(total) - each * n
  return parts.map((c) => c / 100)
}

/**
 * Reparto de un gasto de `importe` (con signo) entre tú y `nombres`:
 * modo 'iguales' (todos lo mismo), 'pct' (tu % y el resto a partes iguales), 'importe' (tu parte y
 * el resto a partes iguales) o 'nada' (todo de los demás). `otros` da a mano lo de cada persona.
 */
export function makeShare({ importe, modo = 'iguales', pct = null, miParte = 0, nombres = [], otros = null, partida = '', nota = '' }) {
  const sign = importe < 0 ? -1 : 1
  const total = Math.abs(importe)
  const names = nombres.map(clean)
  let mine
  if (modo === 'iguales') mine = names.length ? equalParts(total, names.length + 1)[0] : total
  else if (modo === 'pct') mine = round2(total * (pct ?? 0) / 100)
  else if (modo === 'nada') mine = 0
  else mine = Math.min(Math.abs(miParte ?? 0), total)
  const rest = round2(total - mine)
  const amounts = otros ?? equalParts(rest, names.length)
  return {
    miParte: sign * mine,
    pct: modo === 'iguales' && names.length === 1 ? 50 : modo === 'pct' ? pct : modo === 'nada' ? 0 : null,
    personas: names.map((nombre, i) => ({ nombre, importe: round2(amounts[i] ?? 0) })),
    partida: clean(partida),
    nota: clean(nota),
  }
}

/** ¿Las partes (la tuya y las de cada persona) suman el total? */
export const shareAddsUp = (share, importe) =>
  cents(Math.abs(share.miParte)) + share.personas.reduce((s, p) => s + cents(p.importe), 0) === cents(Math.abs(importe))

/** Ajusta un reparto cuando cambia el importe (p. ej. al editar un desglose): todo en proporción. */
export function rescaleShare(share, importe) {
  const s = share && shareOf({ compartido: share, importe })
  if (!s) return share
  const oldTotal = Math.abs(s.miParte) + s.personas.reduce((a, p) => a + p.importe, 0)
  const total = Math.abs(importe)
  if (oldTotal <= 0) return s
  const f = total / oldTotal
  const personas = s.personas.map((p) => ({ ...p, importe: round2(p.importe * f) }))
  const mine = round2(total - personas.reduce((a, p) => a + p.importe, 0))
  return { ...s, miParte: (importe < 0 ? -1 : 1) * mine, personas }
}

// ─── Estadísticas ─────────────────────────────────────────────────────────────

/** Tu parte de los apuntes sin movimiento que tienen categoría, como si fueran movimientos. */
export const apunteTransactions = (apuntes = []) => apuntes
  .filter((a) => a.categoria && a.miParte > 0)
  .map((a) => ({
    id: `apunte:${a.id}`, apunteId: a.id, fechaContable: a.fecha, descripcion: a.descripcion, importe: -a.miParte,
    categoria: a.categoria, subcategoria: a.subcategoria ?? null, accountId: null, notas: a.nota ?? '', esApunte: true,
  }))

/** Movimientos ya desglosados: solo tu parte de cada gasto compartido y sin pagos entre personas. */
export function applyShares(transactions) {
  if (!transactions.some((t) => t.compartido || t.pagoPersona || t.reembolso)) return transactions
  return transactions.filter((t) => !isPayment(t)).map((t) => (t.compartido
    ? { ...t, importe: t.compartido.miParte, importeTotal: t.importe }
    : t))
}

/** La vista para estadísticas (Dashboard, gastos fijos, ahorro y metas…). */
export function forStats(transactions, apuntes = []) {
  const base = applyShares(expandSplits(transactions))
  const extra = apunteTransactions(apuntes)
  return extra.length ? [...base, ...extra] : base
}

// ─── Libro de cuentas con cada persona ────────────────────────────────────────

/**
 * Un apunte por persona y por cosa: `{ key, persona, partida, fecha, descripcion, nota, tipo,
 * efecto, total, miParte, categoria, ref }`. `tipo`: 'gasto' (pagaste tú), 'apunte' (sin
 * movimiento), 'recibido' o 'enviado'. `efecto`: lo que cambia el saldo (+ te debe, − le debes).
 * `ref` dice dónde editarlo: { kind: 'tx', tx, part } o { kind: 'apunte', apunte }.
 */
export function ledger(transactions, apuntes = []) {
  const out = []
  for (const tx of transactions) {
    const pay = paymentOf(tx)
    if (pay) {
      const amount = Math.abs(tx.importe)
      out.push({
        key: `p:${tx.id}`, persona: pay.persona, partida: pay.partida, fecha: tx.fechaContable, descripcion: tx.descripcion, nota: pay.nota || clean(tx.notas),
        tipo: pay.sentido, efecto: pay.sentido === 'recibido' ? -amount : amount, total: amount, miParte: 0, categoria: tx.categoria, ref: { kind: 'tx', tx, part: null },
      })
      continue
    }
    const parts = hasSplit(tx) ? tx.desglose.map((p, i) => [p, i]) : [[tx, null]]
    for (const [p, i] of parts) {
      const s = shareOf(p)
      if (!s) continue
      const people = s.personas.length ? s.personas : [{ nombre: '', importe: round2(Math.abs(p.importe) - Math.abs(s.miParte)) }]
      for (const person of people) {
        out.push({
          key: `g:${tx.id}:${i ?? ''}:${person.nombre}`, persona: person.nombre, partida: s.partida, fecha: tx.fechaContable,
          descripcion: tx.descripcion, nota: s.nota || clean(i == null ? tx.notas : p.notas), tipo: 'gasto', efecto: person.importe,
          total: Math.abs(p.importe), miParte: Math.abs(s.miParte), categoria: p.categoria, ref: { kind: 'tx', tx, part: i },
        })
      }
    }
  }
  for (const a of apuntes) {
    const base = { fecha: a.fecha, descripcion: a.descripcion, nota: clean(a.nota), partida: clean(a.partida), tipo: 'apunte', total: a.importe, miParte: a.miParte ?? 0, categoria: a.categoria ?? null, ref: { kind: 'apunte', apunte: a } }
    if (a.pagadoPor) out.push({ ...base, key: `a:${a.id}`, persona: clean(a.pagadoPor), efecto: -(a.miParte ?? 0) })
    else for (const person of a.personas ?? []) out.push({ ...base, key: `a:${a.id}:${person.nombre}`, persona: clean(person.nombre), efecto: person.importe })
  }
  return out.sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)))
}

/**
 * Saldo y totales por persona, con sus partidas (sin partida: ''):
 * `[{ nombre, saldo, adelantado, debido, recibido, enviado, partidas: [{ nombre, saldo }], n }]`,
 * primero quien más debe (en valor absoluto); sin persona, al final.
 */
export function peopleSummary(entries) {
  const people = new Map()
  for (const e of entries) {
    if (!people.has(e.persona)) people.set(e.persona, { nombre: e.persona, saldo: 0, adelantado: 0, debido: 0, recibido: 0, enviado: 0, partidas: new Map(), n: 0 })
    const p = people.get(e.persona)
    p.saldo += e.efecto
    p.n++
    if (e.tipo === 'recibido') p.recibido += -e.efecto
    else if (e.tipo === 'enviado') p.enviado += e.efecto
    else if (e.efecto >= 0) p.adelantado += e.efecto
    else p.debido += -e.efecto
    p.partidas.set(e.partida, round2((p.partidas.get(e.partida) ?? 0) + e.efecto))
  }
  return [...people.values()].map((p) => ({
    ...p,
    saldo: round2(p.saldo), adelantado: round2(p.adelantado), debido: round2(p.debido), recibido: round2(p.recibido), enviado: round2(p.enviado),
    partidas: [...p.partidas.entries()].map(([nombre, saldo]) => ({ nombre, saldo }))
      .sort((a, b) => (a.nombre === '') - (b.nombre === '') || a.nombre.localeCompare(b.nombre, 'es')),
  })).sort((a, b) => (a.nombre === '') - (b.nombre === '') || Math.abs(b.saldo) - Math.abs(a.saldo) || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Saldo mes a mes (de más antiguo a más reciente): `[{ mes: 'AAAA-MM', cambio, saldo }]`. */
export function monthlyBalance(entries) {
  const byMonth = new Map()
  for (const e of entries) {
    const k = String(e.fecha).slice(0, 7)
    byMonth.set(k, (byMonth.get(k) ?? 0) + e.efecto)
  }
  let saldo = 0
  return [...byMonth.keys()].sort().map((mes) => {
    saldo += byMonth.get(mes)
    return { mes, cambio: round2(byMonth.get(mes)), saldo: round2(saldo) }
  })
}

/** Gastos compartidos (y apuntes) por categoría: `[{ categoria, total, suParte }]`, de más a menos. */
export function spendingByCategory(entries) {
  const m = new Map()
  for (const e of entries) {
    if (e.tipo !== 'gasto' && e.tipo !== 'apunte') continue
    const k = e.categoria ?? null
    const cur = m.get(k) ?? { categoria: k, total: 0, suParte: 0 }
    cur.total += e.total
    cur.suParte += Math.abs(e.efecto)
    m.set(k, cur)
  }
  return [...m.values()].map((x) => ({ ...x, total: round2(x.total), suParte: round2(x.suParte) })).sort((a, b) => b.total - a.total)
}

/** Nombres de personas y de partidas ya usados (para sugerirlos al escribir). */
export function knownNames(entries) {
  const people = new Set(), parts = new Set()
  for (const e of entries) {
    if (e.persona) people.add(e.persona)
    if (e.partida) parts.add(e.partida)
  }
  const sort = (s) => [...s].sort((a, b) => a.localeCompare(b, 'es'))
  return { personas: sort(people), partidas: sort(parts) }
}

/** Texto corto para la lista de movimientos: «👥 Tu parte 60,00 € · con Pablo», «🟢 Pago de Pablo»… */
export function sharedLabel(t, formatEur) {
  const pay = paymentOf(t)
  if (pay) return pay.sentido === 'recibido' ? `🟢 Pago de ${pay.persona || 'otra persona'}` : `🔵 Pago a ${pay.persona || 'otra persona'}`
  const shares = (t.compartido ? [shareOf(t)] : (t.desglose ?? []).map((p) => shareOf(p))).filter(Boolean)
  if (!shares.length) return ''
  const mine = shares.reduce((s, c) => s + Math.abs(c.miParte), 0)
  const names = [...new Set(shares.flatMap((c) => c.personas.map((p) => p.nombre)).filter(Boolean))].join(', ')
  return `👥 Tu parte ${formatEur(mine)}${t.desglose && !t.compartido ? ' de lo compartido' : ''}${names ? ` · con ${names}` : ''}`
}
