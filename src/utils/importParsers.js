import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// Columnas de cargo y abono por separado (en vez de un único importe con signo)
const DEBIT_COL_RE = /^(cargos?|debe|reintegros?|debits?|debit amount|withdrawals?|paid out|money out)\b/i
const CREDIT_COL_RE = /^(abonos?|haber|ingresos?|credits?|credit amount|deposits?|paid in|money in)\b/i
const SINGLE_AMOUNT_COL_RE = /^(importe|cantidad|amount)\b/i

/**
 * Turn raw CSV rows (arrays) into objects. Some banks (e.g. CaixaBank) put
 * titular/IBAN lines before the real header, so the header is the first row
 * that mentions a date and an amount column; falls back to the first row.
 */
export function rowsFromCsvMatrix(matrix) {
  const norm = (c) => String(c ?? '').toLowerCase().trim()
  const isHeader = (row) => {
    const cells = row.map(norm)
    return cells.some((c) => c.includes('fecha') || /\bdate\b/.test(c)) &&
      cells.some((c) => /importe|cantidad|amount|cargo|abono|debit|credit|paid (in|out)|money (in|out)/.test(c))
  }
  const headerIdx = Math.max(0, matrix.findIndex(isHeader))
  // Cabeceras vacías o repetidas no deben pisarse entre sí
  const seen = new Map()
  const headers = (matrix[headerIdx] ?? []).map((h, i) => {
    const name = String(h ?? '').replace(/^﻿/, '').trim() || `Columna ${i + 1}`
    const n = seen.get(name) ?? 0
    seen.set(name, n + 1)
    return n ? `${name}_${n}` : name
  })
  return matrix.slice(headerIdx + 1)
    .filter((row) => row.some((c) => String(c ?? '').trim() !== ''))
    .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])))
}

/**
 * Extractos con cargo y abono en columnas separadas ("Debit Amount" / "Credit Amount",
 * "Paid out" / "Paid in", "Cargo" / "Abono"): añade una columna 'Importe' con signo.
 * No hace nada si ya hay una columna de importe único.
 */
export function withSignedAmount(rows) {
  if (!rows.length) return rows
  const keys = Object.keys(rows[0])
  if (keys.some((k) => SINGLE_AMOUNT_COL_RE.test(k.trim()))) return rows
  const debit = keys.find((k) => DEBIT_COL_RE.test(k.trim()))
  const credit = keys.find((k) => CREDIT_COL_RE.test(k.trim()))
  if (!debit || !credit) return rows
  return rows.map((r) => {
    const empty = String(r[debit] ?? '').trim() === '' && String(r[credit] ?? '').trim() === ''
    return { ...r, Importe: empty ? '' : Math.abs(parseAmount(r[credit])) - Math.abs(parseAmount(r[debit])) }
  })
}

// Nombres de columna habituales en español e inglés, de más a menos específico
const COLUMN_HINTS = {
  fechaValor: ['fecha valor', 'f. valor', 'fecha_valor', 'value date', 'valor'],
  fechaContable: ['fecha contable', 'f. contable', 'f.contable', 'fecha_contable', 'fecha operación', 'fecha operacion',
    'booking date', 'posting date', 'posted date', 'transaction date', 'completed date', 'fecha', 'date'],
  saldo: ['saldo', 'running balance', 'balance'],
  importe: ['importe', 'cantidad', 'amount', 'cargo', 'abono'],
  descripcion: ['concepto', 'descripción', 'descripcion', 'description', 'partner name', 'payee', 'counterparty',
    'merchant', 'narrative', 'details', 'memo', 'reference', 'movimiento', 'comercio'],
}

/**
 * Adivina qué columna del extracto corresponde a cada campo. Prueba las pistas por
 * orden y no reutiliza una columna ya asignada (p. ej. "Value date" no es la fecha contable).
 */
export function guessMapping(keys) {
  const used = new Set()
  const found = {}
  for (const [field, hints] of Object.entries(COLUMN_HINTS)) {
    let key = ''
    for (const h of hints) {
      key = keys.find((k) => !used.has(k) && k.toLowerCase().includes(h)) || ''
      if (key) break
    }
    if (key) used.add(key)
    found[field] = key
  }
  return {
    fechaContable: found.fechaContable,
    fechaValor: found.fechaValor,
    descripcion: found.descripcion,
    importe: found.importe,
    saldo: found.saldo,
  }
}

/**
 * Parse a CSV file and return rows as array of objects.
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => resolve(rowsFromCsvMatrix(results.data)),
      error: (err) => reject(err),
    })
  })
}

/**
 * Bankinter exports include ~19 rows of metadata before the actual data.
 * This function scans the raw sheet for the real header row by looking for
 * a cell containing "Fecha contable" (case-insensitive), then returns rows
 * parsed from that header onwards, merging both sections if needed.
 *
 * Also handles the "movimientos pendientes" section (rows 5-12) which has
 * only 4 columns (Fecha, Descripción, Importe, Divisa) with no Saldo.
 */
function parseBankinterSheet(sheet) {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

  // Find header rows for both sections
  let pendingHeaderIdx = -1
  let mainHeaderIdx = -1

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i].map(c => String(c).toLowerCase().trim())
    if (row.includes('fecha contable')) {
      mainHeaderIdx = i
      break
    }
    // Pending section header: has "fecha" and "importe" but NOT "fecha contable"
    if (pendingHeaderIdx === -1 && row.includes('fecha') && row.includes('importe') && !row.includes('fecha contable')) {
      pendingHeaderIdx = i
    }
  }

  const isDateCell = (val) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(String(val ?? '').trim())

  const results = []

  // Parse pending section (no saldo column) — only rows with a real date in col A
  if (pendingHeaderIdx !== -1) {
    const pendingHeaders = raw[pendingHeaderIdx].map(c => String(c).trim())
    const fechaIdx = pendingHeaders.findIndex(h => h.toLowerCase() === 'fecha')
    const descIdx = pendingHeaders.findIndex(h => h.toLowerCase().startsWith('descrip'))
    const impIdx = pendingHeaders.findIndex(h => h.toLowerCase() === 'importe')
    const endIdx = mainHeaderIdx !== -1 ? mainHeaderIdx : raw.length

    for (let i = pendingHeaderIdx + 1; i < endIdx; i++) {
      const row = raw[i]
      if (!isDateCell(row[fechaIdx])) continue
      results.push({
        'Fecha contable': row[fechaIdx],
        'Fecha valor': row[fechaIdx],
        'Descripción': row[descIdx] ?? '',
        'Importe': row[impIdx] ?? '',
        'Saldo': '',
        __pendiente: true, // aún sin contabilizar: llegará con saldo en el siguiente extracto
      })
    }
  }

  // Parse main section — only rows with a real date in col A
  if (mainHeaderIdx !== -1) {
    const headers = raw[mainHeaderIdx].map(c => String(c).trim())
    for (let i = mainHeaderIdx + 1; i < raw.length; i++) {
      const row = raw[i]
      if (!isDateCell(row[0])) continue
      const obj = {}
      headers.forEach((h, idx) => { obj[h] = row[idx] ?? '' })
      results.push(obj)
    }
  }

  return results
}

function isBankinterFormat(sheet) {
  // Check first cell for account number pattern or "MOVIMIENTOS"
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (!raw.length) return false
  // "MOVIMIENTOS DE LA CUENTA ES12…" (no basta con contener "ES": "DESCRIPTION" también lo contiene)
  const firstCell = String(raw[0][0] ?? '').toUpperCase()
  return firstCell.includes('MOVIMIENTOS') || /\bES\d{2}/.test(firstCell)
}

/**
 * Parse an Excel file and return rows as array of objects.
 * Detects Bankinter format automatically.
 */
export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        if (isBankinterFormat(sheet)) {
          resolve(parseBankinterSheet(sheet))
        } else {
          // Igual que el CSV: la cabecera puede no estar en la primera fila
          resolve(rowsFromCsvMatrix(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })))
        }
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Error leyendo el archivo'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Parse a file based on its extension.
 */
export async function parseFile(file) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.csv')) {
    return withSignedAmount(await parseCSV(file))
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return withSignedAmount(await parseExcel(file))
  } else if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    // pdf.js es grande: solo se carga si hace falta
    const { parsePdfStatement } = await import('./pdfStatement')
    return parsePdfStatement(file, {
      askPassword: (retry) => window.prompt(retry
        ? 'Contraseña incorrecta. Vuelve a escribir la contraseña del PDF:'
        : 'Este PDF está protegido. Escribe la contraseña (suele indicarla el banco):'),
    })
  }
  throw new Error('Formato no soportado. Usa PDF, CSV o Excel (.xlsx/.xls)')
}

/**
 * Importe en formato español ("1.234,56") o inglés ("1,234.56"), con símbolo de moneda,
 * signo delante o detrás ("12,50-") o entre paréntesis ("(12.50)" = negativo).
 */
export function parseAmount(val) {
  if (val === '' || val === undefined || val === null) return 0
  // If already a number (Excel numeric cell), return directly
  if (typeof val === 'number') return val
  let s = String(val).trim()
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  s = s.replace(/[^\d,.\-+]/g, '') // moneda, espacios ("1.000,00EUR", "£ 12.50")
  if (/\d-$/.test(s)) { negative = true; s = s.slice(0, -1) }
  // Spanish format: thousands with dot, decimal with comma → "1.234,56"
  const spanish = /,\d{1,2}$/.test(s) || (/\d\.\d{3}(?!\d)/.test(s) && !/\.\d{1,2}$/.test(s) && !s.includes(','))
  const n = spanish
    ? parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
    // Dot as decimal separator; commas are thousands ("1,234.56")
    : parseFloat(s.replace(/,/g, '')) || 0
  return negative ? -Math.abs(n) : n
}

const MONTH_NAMES = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7,
  ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
}
const monthFromName = (name) => MONTH_NAMES[name.toLowerCase().slice(0, 3)]
const NUMERIC_DATE_RE = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})(?:[\sT].*)?$/

const isoFrom = (y, m, d) => {
  const year = String(y).length === 2 ? `20${y}` : String(y)
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * ¿Las fechas numéricas de la columna son día/mes (España, Reino Unido) o mes/día (EE. UU.)?
 * Si algún primer número pasa de 12 es día/mes; si lo hace el segundo, mes/día. Por defecto, día/mes.
 */
export function detectDayFirst(values) {
  let monthFirst = false
  for (const v of values) {
    const m = String(v ?? '').trim().match(NUMERIC_DATE_RE)
    if (!m) continue
    if (Number(m[1]) > 12) return true
    if (Number(m[2]) > 12) monthFirst = true
  }
  return !monthFirst
}

/** Fecha del extracto → "YYYY-MM-DD" (si no se reconoce, se devuelve tal cual). */
export function parseDate(val, dayFirst = true) {
  if (val === '' || val === undefined || val === null) return ''
  const s = String(val).trim()
  // DD/MM/YYYY, DD-MM-YY… (o MM/DD/YYYY en extractos de EE. UU.), con hora opcional
  const num = s.match(NUMERIC_DATE_RE)
  if (num) {
    const [, a, b, y] = num
    return dayFirst ? isoFrom(y, b, a) : isoFrom(y, a, b)
  }
  // YYYY-MM-DD o YYYY/MM/DD, con hora opcional
  const ymd = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/)
  if (ymd) return isoFrom(ymd[1], ymd[2], ymd[3])
  // YYYYMMDD
  if (/^(19|20)\d{6}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  // "27 Oct 2026", "27-oct-26", "27 de octubre de 2026"
  const dmy = s.match(/^(\d{1,2})(?:\s+de)?[\s\-.]+(\p{L}{3,})\.?(?:\s+de)?[\s\-.,]+(\d{4}|\d{2})\b/u)
  if (dmy && monthFromName(dmy[2])) return isoFrom(dmy[3], monthFromName(dmy[2]), dmy[1])
  // "Oct 27, 2026", "October 27 2026"
  const mdy = s.match(/^(\p{L}{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/u)
  if (mdy && monthFromName(mdy[1])) return isoFrom(mdy[3], monthFromName(mdy[1]), mdy[2])
  // Excel numeric date
  if (typeof val === 'number' || /^\d+(\.\d+)?$/.test(s)) {
    const date = XLSX.SSF.parse_date_code(Math.floor(Number(s)))
    if (date) return isoFrom(date.y, date.m, date.d)
  }
  return s
}

/**
 * Map raw rows to Transaction objects using a column mapping.
 * mapping = { fechaContable, fechaValor, descripcion, importe, saldo }
 * Each value is the key in the raw row to use.
 */
export function mapRows(rows, mapping) {
  const dates = rows.flatMap((r) => [r[mapping.fechaContable], mapping.fechaValor ? r[mapping.fechaValor] : ''])
  const dayFirst = detectDayFirst(dates)
  return rows.map((row, i) => ({
    id: `tx-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
    bankRowIndex: i,
    fechaContable: parseDate(row[mapping.fechaContable], dayFirst),
    fechaValor: mapping.fechaValor ? parseDate(row[mapping.fechaValor], dayFirst) : '',
    descripcion: String(row[mapping.descripcion] ?? '').trim(),
    importe: parseAmount(row[mapping.importe] ?? ''),
    // Sin saldo (pendientes, extractos sin esa columna) es null, no 0: un 0 sería un saldo real
    saldo: mapping.saldo && String(row[mapping.saldo] ?? '').trim() !== '' ? parseAmount(row[mapping.saldo]) : null,
    ...(row.__pendiente ? { pendiente: true } : {}),
    categoria: null,
  }))
}
