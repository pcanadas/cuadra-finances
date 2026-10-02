import Papa from 'papaparse'
import * as XLSX from 'xlsx'

/**
 * Parse a CSV file and return rows as array of objects.
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
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
  const firstCell = String(raw[0][0] ?? '').toUpperCase()
  return firstCell.includes('MOVIMIENTOS') || firstCell.includes('ES') // IBAN starts with ES
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
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
          resolve(rows)
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
    return parseCSV(file)
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseExcel(file)
  }
  throw new Error('Formato no soportado. Usa CSV o Excel (.xlsx/.xls)')
}

/**
 * Map raw rows to Transaction objects using a column mapping.
 * mapping = { fechaContable, fechaValor, descripcion, importe, saldo }
 * Each value is the key in the raw row to use.
 */
export function mapRows(rows, mapping) {
  return rows.map((row, i) => {
    const rawImporte = row[mapping.importe] ?? ''
    const rawSaldo = row[mapping.saldo] ?? ''

    const parseAmount = (val) => {
      if (val === '' || val === undefined || val === null) return 0
      // If already a number (Excel numeric cell), return directly
      if (typeof val === 'number') return val
      const s = String(val).trim()
      // Spanish format: thousands with dot, decimal with comma → "1.234,56"
      if (/\d\.\d{3}/.test(s) || /,\d{1,2}$/.test(s)) {
        const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^\d\-+.]/g, '')
        return parseFloat(cleaned) || 0
      }
      // Already uses dot as decimal separator
      return parseFloat(s.replace(/[^\d\-+.]/g, '')) || 0
    }

    const parseDate = (val) => {
      if (!val) return ''
      // Try to detect DD/MM/YYYY or DD-MM-YYYY
      const s = String(val).trim()
      const match = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
      if (match) {
        const [, d, m, y] = match
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      }
      // Try YYYY-MM-DD passthrough
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
      // Excel numeric date
      if (/^\d+$/.test(s)) {
        const date = XLSX.SSF.parse_date_code(parseInt(s))
        if (date) {
          return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
        }
      }
      return s
    }

    return {
      id: `tx-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      fechaContable: parseDate(row[mapping.fechaContable]),
      fechaValor: mapping.fechaValor ? parseDate(row[mapping.fechaValor]) : '',
      descripcion: String(row[mapping.descripcion] ?? '').trim(),
      importe: parseAmount(rawImporte),
      saldo: parseAmount(rawSaldo),
      categoria: null,
    }
  })
}
