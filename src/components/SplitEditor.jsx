import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useBackHandler } from '../platform/back'
import { hasSplit, splitRemainder } from '../utils/splits'
import SelectSheet from './SelectSheet'

function formatEur(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

const parseAmount = (v) => parseFloat(String(v).replace(',', '.'))
const amountText = (n) => n.toFixed(2).replace('.', ',')
const emptyPart = (importe = '') => ({ importe, categoria: '', subcategoria: '', notas: '' })

/**
 * Desglosar un movimiento en partidas (ver utils/splits.js). En escritorio, una fila por partida;
 * en el móvil, una tarjeta por partida con campos grandes. `onSave(desglose)`; `onSave(null)` lo quita.
 */
export default function SplitEditor({ transaction, categories, subcategories, onSave, onClose }) {
  const sign = transaction.importe < 0 ? -1 : 1
  const total = Math.abs(transaction.importe)
  // En el formulario los importes van sin signo; se guardan con el del movimiento
  const [parts, setParts] = useState(() => hasSplit(transaction)
    ? transaction.desglose.map((p) => ({ ...p, importe: amountText(Math.abs(p.importe)), subcategoria: p.subcategoria ?? '', notas: p.notas ?? '' }))
    : [
        { ...emptyPart(amountText(total)), categoria: transaction.categoria ?? '', subcategoria: transaction.subcategoria ?? '' },
        emptyPart(),
      ])
  const [error, setError] = useState('')
  useBackHandler(true, onClose)

  // Un traspaso no se reparte: sus categorías no se ofrecen
  const options = useMemo(
    () => categories.filter((c) => !c.esTransferencia).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [categories]
  )
  const remainder = splitRemainder(total, parts.map((p) => ({ importe: parseAmount(p.importe) || 0 })))

  const setPart = (i, changes) => setParts((ps) => ps.map((p, j) => (j === i ? { ...p, ...changes } : p)))
  const addPart = () => setParts((ps) => [...ps, emptyPart(remainder > 0 ? amountText(remainder) : '')])
  const removePart = (i) => setParts((ps) => ps.filter((_, j) => j !== i))
  function fillRemainder() {
    const last = parts.length - 1
    setPart(last, { importe: amountText((parseAmount(parts[last].importe) || 0) + remainder) })
  }

  function handleSubmit(e) {
    e.preventDefault()
    const filled = parts.filter((p) => p.importe !== '' || p.categoria)
    if (filled.length < 2) return setError('Un desglose necesita al menos dos partidas')
    if (filled.some((p) => !(parseAmount(p.importe) > 0))) return setError('Cada partida necesita un importe mayor que cero')
    if (filled.some((p) => !p.categoria)) return setError('Cada partida necesita una categoría')
    if (remainder !== 0) return setError(`Las partidas deben sumar ${formatEur(total)}`)
    onSave(filled.map((p) => ({
      importe: sign * Math.round(parseAmount(p.importe) * 100) / 100,
      categoria: p.categoria,
      subcategoria: p.subcategoria || null,
      notas: p.notas.trim(),
    })))
  }

  const inputCls = 'w-full border border-slate-200 rounded-lg px-2 py-2 lg:py-1.5 text-base lg:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300'
  const selectCls = 'w-full py-2 lg:py-1.5 text-base lg:text-sm'
  // Escritorio: una fila con columnas; móvil: tarjeta (importe y ✕ arriba, el resto debajo a lo ancho)
  const row = 'grid grid-cols-[1fr_2rem] lg:grid-cols-[6rem_1fr_1fr_1fr_1.5rem] gap-2 items-center'
  const wide = 'col-span-2 lg:col-span-1'

  let datePart
  try { datePart = format(new Date(transaction.fechaContable), 'dd/MM/yyyy') } catch { datePart = transaction.fechaContable }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 p-5 lg:p-6 w-full max-w-3xl sm:mx-4 max-h-[90vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(1.25rem + var(--sab))' }}
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-slate-800 mb-1">Desglosar movimiento</h2>
        <p className="text-xs text-slate-500 mb-4">
          {transaction.descripcion} · {datePart} ·{' '}
          <span className={`font-semibold ${sign < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatEur(transaction.importe)}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="hidden lg:grid grid-cols-[6rem_1fr_1fr_1fr_1.5rem] gap-2 text-xs font-medium text-slate-500">
            <span>Importe</span><span>Categoría</span><span>Subcategoría</span><span>Nota</span><span />
          </div>
          {parts.map((p, i) => {
            const subs = p.categoria ? subcategories.filter((s) => s.categoriaId === p.categoria) : []
            return (
              <div key={i} className={`${row} p-3 lg:p-0 rounded-xl border border-slate-200 lg:border-0`}>
                <input type="text" inputMode="decimal" placeholder="Importe" value={p.importe} aria-label="Importe"
                  onChange={(e) => setPart(i, { importe: e.target.value })} className={`${inputCls} lg:text-right`} />
                <button type="button" onClick={() => removePart(i)} disabled={parts.length <= 2}
                  className="lg:order-last text-red-400 hover:text-red-600 disabled:opacity-20 text-base lg:text-sm justify-self-center" title="Quitar partida">✕</button>
                <div className={wide}>
                  <SelectSheet title="Categoría" className={selectCls} value={p.categoria}
                    onChange={(v) => setPart(i, { categoria: v, subcategoria: '' })}
                    options={[{ value: '', label: 'Categoría…' }, ...options.map((c) => ({ value: c.id, label: c.nombre, color: c.color }))]} />
                </div>
                {/* Sin subcategorías: en el móvil no ocupa sitio; en escritorio deja la columna vacía */}
                <div className={`${wide} ${subs.length ? '' : 'hidden lg:block opacity-40 pointer-events-none'}`}>
                  <SelectSheet title="Subcategoría" className={selectCls} value={p.subcategoria}
                    onChange={(v) => setPart(i, { subcategoria: v })}
                    options={[{ value: '', label: subs.length ? 'Subcategoría…' : '—' }, ...subs.map((s) => ({ value: s.id, label: s.nombre }))]} />
                </div>
                <input type="text" placeholder="Nota (p. ej. Pienso)" value={p.notas} aria-label="Nota"
                  onChange={(e) => setPart(i, { notas: e.target.value })} className={`${inputCls} ${wide}`} />
              </div>
            )
          })}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
            <button type="button" onClick={addPart} className="text-sm text-indigo-600 hover:text-indigo-800 py-1">＋ Añadir partida</button>
            <span className={`ml-auto text-sm ${remainder === 0 ? 'text-green-600' : 'text-amber-600'}`}>
              {remainder === 0
                ? '✓ Cuadra con el movimiento'
                : remainder > 0 ? `Falta por repartir: ${formatEur(remainder)}` : `Te pasas en ${formatEur(-remainder)}`}
            </span>
            {remainder !== 0 && (
              <button type="button" onClick={fillRemainder} className="text-xs text-indigo-600 hover:text-indigo-800 underline py-1">
                Ajustar la última partida
              </button>
            )}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-3 lg:py-2 rounded-xl lg:rounded-lg transition-colors">
              Guardar desglose
            </button>
            {hasSplit(transaction) && (
              <button type="button" onClick={() => onSave(null)}
                className="px-4 py-3 lg:py-2 text-sm rounded-xl lg:rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                Quitar desglose
              </button>
            )}
            <button type="button" onClick={onClose}
              className="px-4 py-3 lg:py-2 text-sm rounded-xl lg:rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
