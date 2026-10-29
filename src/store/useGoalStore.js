import { create } from 'zustand'
import db, { live, softDelete } from '../db/db'
import { newId } from '../db/ids'

/**
 * Planes de ahorro y metas (ver insights/goals.js):
 * {
 *   id, tipo: 'ahorro'|'meta', nombre,
 *   importeMensual,                      // ahorro
 *   objetivo, fechaObjetivo: 'AAAA-MM',  // meta
 *   inicial,                             // meta: lo que ya se tenía
 *   modo: 'cuenta'|'apartado', accountId, // cuenta a la que se traspasa
 *   desde: 'AAAA-MM'|null, creadoEn: ISO,
 * }
 */
const useGoalStore = create((set) => ({
  goals: [],
  loaded: false,

  loadFromDB: async () => {
    const goals = await live(db.goals)
    set({ goals, loaded: true })
  },

  addGoal: async (goal) => {
    const newGoal = { ...goal, id: newId(), creadoEn: new Date().toISOString() }
    await db.goals.put(newGoal)
    set((s) => ({ goals: [...s.goals, newGoal] }))
  },

  updateGoal: async (id, updates) => {
    await db.goals.update(id, updates)
    set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...updates } : g)) }))
  },

  deleteGoal: async (id) => {
    await softDelete(db.goals, [id])
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }))
  },
}))

export default useGoalStore
