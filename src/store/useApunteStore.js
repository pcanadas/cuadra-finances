import { create } from 'zustand'
import db, { live, softDelete } from '../db/db'
import { newId } from '../db/ids'

/**
 * Apuntes de gastos compartidos sin movimiento en tus cuentas (ver utils/shared.js):
 * {
 *   id, fecha: 'AAAA-MM-DD', descripcion, importe,     // importe total, en positivo
 *   pagadoPor: 'Pablo' | '',                            // '' = lo pagaste tú (efectivo, otra tarjeta…)
 *   miParte,                                            // en positivo
 *   personas: [{ nombre, importe }],                    // solo si pagaste tú: lo que te debe cada una
 *   categoria, subcategoria,                            // con categoría, tu parte cuenta como gasto
 *   partida, nota,
 * }
 */
const useApunteStore = create((set) => ({
  apuntes: [],
  loaded: false,

  loadFromDB: async () => {
    const apuntes = await live(db.apuntes)
    set({ apuntes, loaded: true })
  },

  addApunte: async (apunte) => {
    const item = { ...apunte, id: newId() }
    await db.apuntes.put(item)
    set((s) => ({ apuntes: [...s.apuntes, item] }))
  },

  updateApunte: async (id, updates) => {
    await db.apuntes.update(id, updates)
    set((s) => ({ apuntes: s.apuntes.map((a) => (a.id === id ? { ...a, ...updates } : a)) }))
  },

  deleteApunte: async (id) => {
    await softDelete(db.apuntes, [id])
    set((s) => ({ apuntes: s.apuntes.filter((a) => a.id !== id) }))
  },
}))

export default useApunteStore
