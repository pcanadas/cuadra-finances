import { deviceId } from './ids'

/**
 * Hybrid Logical Clock: marca de cada escritura para decidir qué cambio gana al sincronizar.
 * Formato `<ms 13 dígitos>:<contador base36 5>:<deviceId>`, comparable como texto. El contador
 * ordena las escrituras del mismo milisegundo y hace que la marca nunca retroceda aunque el
 * reloj del sistema lo haga.
 */

let lastMs = 0
let counter = 0

export function nextHlc(now = Date.now()) {
  if (now > lastMs) {
    lastMs = now
    counter = 0
  } else {
    counter++
  }
  return `${String(lastMs).padStart(13, '0')}:${counter.toString(36).padStart(5, '0')}:${deviceId()}`
}

/** Milisegundos de una marca (para mostrar o comparar con fechas). */
export const hlcTime = (hlc) => Number(String(hlc).slice(0, 13))
