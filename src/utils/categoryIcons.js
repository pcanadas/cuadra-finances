/**
 * Iconos de categoría (emoji). Cada categoría puede guardar el suyo en `icono`;
 * si no lo tiene, se deduce del nombre. Se configuran en Ajustes.
 */

// Palabra (sin tildes, en minúsculas) → icono por defecto
const DEFAULTS = [
  ['mercadona', '🛒'], ['carrefour', '🛒'], ['super', '🛒'], ['compra', '🛒'], ['aliment', '🛒'],
  ['gasolina', '⛽'], ['peaje', '⛽'], ['coche', '🚗'], ['transporte', '🚌'], ['parking', '🅿️'],
  ['luz', '💡'], ['electric', '💡'], ['agua', '💧'], ['gas', '🔥'], ['telefono', '📱'], ['internet', '🌐'],
  ['alquiler', '🏠'], ['hipoteca', '🏠'], ['vivienda', '🏠'], ['hogar', '🏠'], ['comunidad', '🏢'],
  ['seguro', '🛡️'], ['educacion', '🎓'], ['colegio', '🎓'], ['restaurante', '🍽️'], ['bar', '🍺'],
  ['amazon', '📦'], ['plataforma', '📺'], ['suscrip', '📺'], ['farmacia', '💊'], ['medico', '🩺'],
  ['salud', '🩺'], ['ropa', '👕'], ['ocio', '🎉'], ['viaje', '✈️'], ['regalo', '🎁'], ['mascota', '🐾'],
  ['deporte', '🏋️'], ['gimnasio', '🏋️'], ['nino', '🧸'], ['impuesto', '🏛️'], ['banco', '🏦'],
  ['autonomo', '🧾'], ['seguridad social', '🧾'], ['ingreso', '💶'], ['nomina', '💶'], ['transferencia', '🔁'], ['otros', '📌'],
]

export const DEFAULT_ICON = '🏷️'

function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function getCategoryIcon(cat) {
  if (!cat) return DEFAULT_ICON
  if (cat.icono) return cat.icono
  const name = normalize(cat.nombre)
  const hit = DEFAULTS.find(([word]) => name.includes(word))
  return hit ? hit[1] : DEFAULT_ICON
}

// Paleta para el selector de Ajustes, agrupada por temas
export const ICON_GROUPS = [
  { nombre: 'Compras', iconos: ['🛒', '🛍️', '📦', '👕', '👟', '💄', '🧴', '🎁'] },
  { nombre: 'Comida', iconos: ['🍽️', '🍕', '🍔', '☕', '🍺', '🍷', '🥐', '🍎'] },
  { nombre: 'Hogar', iconos: ['🏠', '🏢', '💡', '💧', '🔥', '📱', '🌐', '🧹', '🛋️', '🔧'] },
  { nombre: 'Transporte', iconos: ['🚗', '⛽', '🚌', '🚆', '🚕', '🅿️', '🛵', '✈️'] },
  { nombre: 'Salud', iconos: ['💊', '🩺', '🦷', '👓', '🏋️', '🧘'] },
  { nombre: 'Ocio', iconos: ['🎉', '🎬', '📺', '🎮', '🎵', '📚', '⚽', '🏖️'] },
  { nombre: 'Familia', iconos: ['🎓', '🧸', '👶', '🐾', '👵', '❤️'] },
  { nombre: 'Finanzas', iconos: ['💶', '💰', '🏦', '💳', '🏛️', '🛡️', '📈', '🔁'] },
  { nombre: 'Otros', iconos: ['📌', '🏷️', '⭐', '❓'] },
]
