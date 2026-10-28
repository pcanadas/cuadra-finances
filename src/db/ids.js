/**
 * Identificadores para la sincronización entre dispositivos.
 * - newId(): UUID v7 (ordenado por tiempo, único entre dispositivos) para los registros nuevos.
 *   Los ids anteriores (`tx-…`, `cat-1`…) se conservan: ya son cadenas únicas y los de las
 *   categorías y cuentas iniciales coinciden a propósito en todos los dispositivos.
 * - deviceId(): id de este dispositivo; no viaja en las copias de seguridad.
 */

const DEVICE_KEY = 'cuadra.deviceId'

const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')

export function newId(now = Date.now()) {
  const b = crypto.getRandomValues(new Uint8Array(16))
  // 48 bits de milisegundos, versión 7 y variante RFC 9562
  for (let i = 0; i < 6; i++) b[i] = Math.floor(now / 2 ** (8 * (5 - i))) & 0xff
  b[6] = (b[6] & 0x0f) | 0x70
  b[8] = (b[8] & 0x3f) | 0x80
  const h = hex(b)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

let cachedDeviceId = null

export function deviceId() {
  if (cachedDeviceId) return cachedDeviceId
  try { cachedDeviceId = localStorage.getItem(DEVICE_KEY) } catch { /* sin almacenamiento */ }
  if (!cachedDeviceId) {
    cachedDeviceId = newId()
    try { localStorage.setItem(DEVICE_KEY, cachedDeviceId) } catch { /* sin almacenamiento: id solo de esta sesión */ }
  }
  return cachedDeviceId
}
