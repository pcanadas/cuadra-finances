/**
 * Desglose de un movimiento en varias partidas (p. ej. un cargo de Amazon o PayPal que reúne
 * comida de animales, ropa y papelería).
 *
 * El movimiento conserva su importe y descripción (sigue cuadrando con el extracto) y guarda en
 * `desglose` las partidas: `{ importe, categoria, subcategoria, notas }`, con el mismo signo que
 * el movimiento y sumando exactamente su importe. Mientras tiene desglose, su propia categoría
 * queda vacía: las estadísticas cuentan las partidas (ver expandSplits).
 */

const cents = (n) => Math.round((Number(n) || 0) * 100)

export const hasSplit = (t) => Array.isArray(t?.desglose) && t.desglose.length > 0

/** Lo que falta por repartir (con el signo del movimiento); 0 si las partidas cuadran. */
export function splitRemainder(total, parts) {
  return (cents(total) - parts.reduce((s, p) => s + cents(p.importe), 0)) / 100
}

/**
 * Movimientos con cada desglose sustituido por sus partidas, para sumar por categoría.
 * Cada partida hereda fecha, cuenta, descripción… del movimiento; su id es `<id>:<n>` y
 * `splitOf` apunta al original. No sirven para editar: los cambios van al movimiento original.
 */
export function expandSplits(transactions) {
  if (!transactions.some(hasSplit)) return transactions
  return transactions.flatMap((t) => {
    if (!hasSplit(t)) return [t]
    return t.desglose.map((p, i) => {
      const { desglose: _, ...rest } = t
      return {
        ...rest,
        id: `${t.id}:${i}`,
        splitOf: t.id,
        importe: p.importe,
        categoria: p.categoria || null,
        subcategoria: p.subcategoria || null,
        notas: p.notas || t.notas || '',
      }
    })
  })
}
