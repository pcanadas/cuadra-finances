import { create } from 'zustand'
import db, { live, softDelete } from '../db/db'
import { newId } from '../db/ids'

const useBudgetStore = create((set, get) => ({
  budgets: [],
  loaded: false,

  loadFromDB: async () => {
    const budgets = await live(db.budgets)
    set({ budgets, loaded: true })
  },

  setBudget: async (categoriaId, limite) => {
    const existing = get().budgets.find((b) => b.categoriaId === categoriaId)
    if (limite <= 0) {
      // Remove budget
      if (existing) {
        await softDelete(db.budgets, [existing.id])
        set((s) => ({ budgets: s.budgets.filter((b) => b.id !== existing.id) }))
      }
      return
    }
    if (existing) {
      await db.budgets.update(existing.id, { limite })
      set((s) => ({
        budgets: s.budgets.map((b) => (b.id === existing.id ? { ...b, limite } : b)),
      }))
    } else {
      const newBudget = { id: newId(), categoriaId, limite }
      await db.budgets.put(newBudget)
      set((s) => ({ budgets: [...s.budgets, newBudget] }))
    }
  },

  getBudget: (categoriaId) => get().budgets.find((b) => b.categoriaId === categoriaId),
}))

export default useBudgetStore
