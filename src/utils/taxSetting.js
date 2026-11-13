/**
 * «Separar impuestos» (Ajustes): el Dashboard muestra aparte los movimientos de las categorías
 * marcadas como impuestos (`esImpuesto`), para que el pago de la renta no infle los gastos, el
 * balance ni el gasto diario. Se guarda por dispositivo; el marcado de categorías va con los datos.
 */
const KEY = 'zenit.separarImpuestos'

export function getSeparateTaxes() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setSeparateTaxes(on) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // sin almacenamiento: se queda como estaba
  }
}
