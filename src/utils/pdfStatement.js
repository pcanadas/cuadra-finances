/**
 * Extractos bancarios en PDF → filas con las mismas columnas que el CSV/Excel
 * ('Fecha contable', 'Fecha valor', 'Descripción', 'Importe', 'Saldo').
 *
 * El PDF solo tiene texto suelto con posiciones, así que:
 *  1. se reconstruyen las líneas (agrupando por altura en la página),
 *  2. un movimiento es una línea que empieza por fecha y termina en importe(s),
 *  3. las líneas sin fecha alineadas con la descripción la continúan,
 *  4. el signo sale del propio texto ("-12,50"), de columnas Cargo/Abono o,
 *     si no hay más remedio, de la evolución del saldo.
 *
 * `parseStatementLines` es puro (testeable); `parsePdfStatement` lee el archivo con pdf.js.
 */

const DATE = String.raw`\d{1,2}[\/\-.]\d{1,2}[\/\-.](?:\d{4}|\d{2})`
const AMOUNT = String.raw`[-+]?\d{1,3}(?:\.\d{3})*,\d{2}(?:\s?-)?(?:\s?(?:€|EUR))?`

const LEADING_DATES_RE = new RegExp(String.raw`^\s*(${DATE})(?:\s+(${DATE}))?\s+`)
const TRAILING_AMOUNTS_RE = new RegExp(String.raw`(?:^|\s)(${AMOUNT})(?:\s+(${AMOUNT}))?\s*$`)
const ANY_AMOUNT_RE = new RegExp(AMOUNT)

// Líneas de pie/cabecera que no deben pegarse a una descripción
const NOISE_RE = /p[aá]gina\s+\d+|^\s*\d+\s*\/\s*\d+\s*$|saldo\s+(anterior|inicial|final)|^\s*total|suma\s+y\s+sigue/i

const DEBIT_HEADER_RE = /^(cargos?|debe|reintegros?|pagos?|salidas?|gastos?)$/i
const CREDIT_HEADER_RE = /^(abonos?|haber|ingresos?|entradas?)$/i
const BALANCE_HEADER_RE = /^saldo$/i

export function normalizeDate(s) {
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (!m) return s
  const [, d, mo, y] = m
  const year = y.length === 2 ? `20${y}` : y
  return `${d.padStart(2, '0')}/${mo.padStart(2, '0')}/${year}`
}

/** "1.234,56", "-12,50", "12,50-", "12,50 €" → número (con signo si lo trae). */
export function parseSpanishAmount(s) {
  const raw = s.replace(/€|EUR/g, '').trim()
  const negative = raw.startsWith('-') || raw.endsWith('-')
  const n = parseFloat(raw.replace(/[-+\s]/g, '').replace(/\./g, '').replace(',', '.'))
  return negative ? -n : n
}

const hasExplicitSign = (s) => /^\s*[-+]|-\s*(?:€|EUR)?\s*$/.test(s)

/** Une los textos de una línea y sabe en qué x cae cada carácter. */
function joinLine(items) {
  let text = ''
  const spans = []
  for (const it of items) {
    if (text && !text.endsWith(' ') && !it.str.startsWith(' ')) text += ' '
    spans.push({ start: text.length, len: it.str.length, x: it.x, w: it.w || 0 })
    text += it.str
  }
  const xAt = (offset) => {
    const span = spans.findLast((s) => s.start <= offset) ?? spans[0]
    if (!span) return 0
    const frac = span.len ? Math.min(1, (offset - span.start) / span.len) : 0
    return span.x + frac * span.w
  }
  return { text: text.replace(/\s+$/, ''), xAt }
}

/** Columnas Cargo/Abono/Saldo a partir de una línea de cabecera, si la hay. */
function findColumns(lines) {
  for (const line of lines) {
    const cols = {}
    for (const it of line.items) {
      const word = it.str.trim()
      const center = it.x + (it.w || 0) / 2
      if (DEBIT_HEADER_RE.test(word)) cols.debit = center
      else if (CREDIT_HEADER_RE.test(word)) cols.credit = center
      else if (BALANCE_HEADER_RE.test(word)) cols.balance = center
    }
    if (cols.debit != null && cols.credit != null) return cols
  }
  return null
}

/**
 * @param {{ page: number, y: number, items: { str: string, x: number, w?: number }[] }[]} lines
 *   Líneas en orden de lectura (y en coordenadas PDF: mayor = más arriba).
 * @returns {object[]} filas con las columnas estándar
 */
export function parseStatementLines(lines) {
  const columns = findColumns(lines)
  const movements = []
  let current = null

  for (const line of lines) {
    const { text, xAt } = joinLine(line.items)
    if (!text.trim()) continue

    const dates = text.match(LEADING_DATES_RE)
    const amounts = dates ? text.match(TRAILING_AMOUNTS_RE) : null

    if (dates && amounts) {
      const descStart = dates[0].length
      const descEnd = amounts.index + (amounts[0].startsWith(' ') ? 1 : 0)
      const amountTexts = [amounts[1], amounts[2]].filter(Boolean)
      const amountXs = amountTexts.map((a) => xAt(text.lastIndexOf(a) + a.length / 2))
      current = {
        page: line.page,
        y: line.y,
        descX: xAt(descStart),
        fechaContable: normalizeDate(dates[1]),
        fechaValor: normalizeDate(dates[2] ?? dates[1]),
        descripcion: text.slice(descStart, descEnd).trim(),
        amountTexts,
        amountXs,
      }
      movements.push(current)
      continue
    }

    // Continuación de la descripción: sin fecha ni importes, alineada y pegada a la anterior
    if (current && !dates && !ANY_AMOUNT_RE.test(text) && !NOISE_RE.test(text) && line.page === current.page) {
      const x = xAt(text.search(/\S/))
      const gap = current.y - line.y
      if (Math.abs(x - current.descX) < 12 && gap > 0 && gap < 30) {
        current.descripcion = `${current.descripcion} ${text.trim()}`
        current.y = line.y
        continue
      }
    }
    if (dates) current = null
  }

  // Importe y saldo de cada movimiento
  const rows = movements.map((m) => {
    let importeText = m.amountTexts[0]
    let saldoText = m.amountTexts.length > 1 ? m.amountTexts[1] : null
    let sign = null

    if (columns) {
      // Con columnas Cargo/Abono/Saldo, la posición manda
      const near = (x, col) => (col == null ? Infinity : Math.abs(x - col))
      const balanceIdx = m.amountXs.findIndex((x) => near(x, columns.balance) < Math.min(near(x, columns.debit), near(x, columns.credit)))
      if (balanceIdx !== -1) {
        saldoText = m.amountTexts[balanceIdx]
        importeText = m.amountTexts[balanceIdx === 0 ? 1 : 0] ?? null
      }
      const ix = m.amountXs[m.amountTexts.indexOf(importeText)]
      if (ix != null) sign = near(ix, columns.debit) < near(ix, columns.credit) ? -1 : 1
    }

    const importe = importeText == null ? 0 : parseSpanishAmount(importeText)
    return {
      'Fecha contable': m.fechaContable,
      'Fecha valor': m.fechaValor,
      'Descripción': m.descripcion,
      'Importe': sign != null ? sign * Math.abs(importe) : importe,
      'Saldo': saldoText != null ? parseSpanishAmount(saldoText) : '',
      _explicitSign: importeText != null && hasExplicitSign(importeText),
    }
  })

  inferSignsFromBalance(rows, !!columns)
  return rows.map(({ _explicitSign, ...r }) => r) // eslint-disable-line no-unused-vars
}

/**
 * Si los importes vienen sin signo (y no había columnas Cargo/Abono), lo deduce
 * del saldo: saldo = saldo anterior ± importe. Prueba orden ascendente y descendente.
 */
function inferSignsFromBalance(rows, signsFromColumns) {
  if (signsFromColumns || rows.some((r) => r._explicitSign)) return
  if (rows.length < 2 || rows.some((r) => r.Saldo === '')) return

  const close = (a, b) => Math.abs(a - b) < 0.015
  const signsFor = (prevIndex) => rows.map((r, i) => {
    const prev = rows[prevIndex(i)]
    if (!prev) return null
    const amount = Math.abs(r.Importe)
    if (close(prev.Saldo + amount, r.Saldo)) return 1
    if (close(prev.Saldo - amount, r.Saldo)) return -1
    return null
  })

  const asc = signsFor((i) => i - 1)
  const desc = signsFor((i) => i + 1)
  const score = (s) => s.filter((v) => v != null).length
  const best = score(asc) >= score(desc) ? asc : desc
  if (score(best) === 0) return

  rows.forEach((r, i) => {
    const s = best[i]
    if (s != null) r.Importe = s * Math.abs(r.Importe)
  })
}

// ─── Lectura del PDF (pdf.js) ───────────────────────────────────────────────

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs
}

/** Agrupa los textos de una página en líneas (misma altura ± tolerancia). */
export function groupLines(items, page) {
  const tol = 2.5
  const lines = []
  for (const it of items) {
    if (!it.str?.trim()) continue
    const x = it.transform[4]
    const y = it.transform[5]
    let line = lines.find((l) => Math.abs(l.y - y) <= tol)
    if (!line) { line = { page, y, items: [] }; lines.push(line) }
    line.items.push({ str: it.str, x, w: it.width })
  }
  lines.sort((a, b) => b.y - a.y)
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x))
  return lines
}

/**
 * @param {File} file
 * @param {{ askPassword?: (retry: boolean) => string | null }} [opts]
 */
export async function parsePdfStatement(file, { askPassword } = {}) {
  const pdfjs = await loadPdfJs()
  const data = new Uint8Array(await file.arrayBuffer())

  let password
  let task
  let doc
  for (let attempt = 0; ; attempt++) {
    task = pdfjs.getDocument({ data: data.slice(), password, isEvalSupported: false })
    try {
      doc = await task.promise
      break
    } catch (e) {
      await task.destroy()
      if (e?.name !== 'PasswordException' || !askPassword) throw e
      password = askPassword(attempt > 0)
      if (password == null) throw new Error('Importación cancelada: el PDF está protegido con contraseña')
    }
  }

  const lines = []
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      lines.push(...groupLines(content.items, p))
    }
  } finally {
    await task.destroy()
  }

  if (!lines.length) {
    throw new Error('El PDF no tiene texto (parece una imagen escaneada). Descarga el extracto en PDF desde la app o la web del banco.')
  }
  const rows = parseStatementLines(lines)
  if (!rows.length) {
    throw new Error('No se han encontrado movimientos en el PDF. Si es un extracto de tu banco, envíanos un ejemplo para darle soporte.')
  }
  return rows
}
