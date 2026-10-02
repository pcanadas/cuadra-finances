import { create } from 'zustand'
import db from '../db/db'

const useSubcategoryStore = create((set) => ({
  subcategories: [],
  loaded: false,

  loadFromDB: async () => {
    const subcategories = await db.subcategories.toArray()
    set({ subcategories, loaded: true })
  },

  addSubcategory: async (subcat) => {
    const newSub = { ...subcat, id: `subcat-${Date.now()}` }
    await db.subcategories.put(newSub)
    set((state) => ({ subcategories: [...state.subcategories, newSub] }))
  },

  updateSubcategory: async (id, updates) => {
    await db.subcategories.update(id, updates)
    set((state) => ({
      subcategories: state.subcategories.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    }))
  },

  deleteSubcategory: async (id) => {
    await db.subcategories.delete(id)
    set((state) => ({ subcategories: state.subcategories.filter((s) => s.id !== id) }))
  },
}))

export default useSubcategoryStore
