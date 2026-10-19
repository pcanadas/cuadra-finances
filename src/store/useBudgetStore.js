import { create } from 'zustand'
import db from '../db/db'

const useBudgetStore = create((set, get) => ({
  budgets: [],
  loaded: false,

  loadFromDB: async () => {
    const budgets = await db.budgets.toArray()
    set({ budgets, loaded: true })
  },

  setBudget: async (categoriaId, limite) => {
    const existing = get().budgets.find((b) => b.categoriaId === categoriaId)
    if (limite <= 0) {
      // Remove budget
      if (existing) {
        await db.budgets.delete(existing.id)
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
      const newBudget = { id: `budget-${Date.now()}`, categoriaId, limite }
      await db.budgets.put(newBudget)
      set((s) => ({ budgets: [...s.budgets, newBudget] }))
    }
  },

  getBudget: (categoriaId) => get().budgets.find((b) => b.categoriaId === categoriaId),
}))

export default useBudgetStore
