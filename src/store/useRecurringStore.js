import { create } from 'zustand'
import db, { live, softDelete } from '../db/db'
import { newId } from '../db/ids'

/**
 * Recurring expense record:
 * {
 *   id:          string,
 *   nombre:      string,       // "Gimnasio", "Hipoteca"…
 *   importe:     number,       // estimated amount per period (positive)
 *   categoriaId: string|null,
 *   subcategoriaId: string|null,
 *   periodicidad: 'mensual'|'bimestral'|'trimestral'|'semestral'|'anual',
 *   fechaFin:    string|null,  // ISO date — null = indefinido
 *   activo:      boolean,
 * }
 */

const useRecurringStore = create((set, get) => ({
  items: [],
  loaded: false,

  loadFromDB: async () => {
    const items = await live(db.recurringExpenses)
    set({ items, loaded: true })
  },

  addItem: async (item) => {
    const newItem = {
      ...item,
      id: newId(),
      activo: true,
    }
    await db.recurringExpenses.put(newItem)
    set((s) => ({ items: [...s.items, newItem] }))
  },

  updateItem: async (id, updates) => {
    await db.recurringExpenses.update(id, updates)
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }))
  },

  deleteItem: async (id) => {
    await softDelete(db.recurringExpenses, [id])
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
  },
}))

export default useRecurringStore
