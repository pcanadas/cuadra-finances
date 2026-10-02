import { create } from 'zustand'
import db from '../db/db'

const DEFAULT_CATEGORIES = [
  { id: 'cat-1',  nombre: 'Mercadona',               palabrasClave: ['MERCADONA'],                                  color: '#10b981' },
  { id: 'cat-2',  nombre: 'Carrefour',                palabrasClave: ['CARREFOUR'],                                  color: '#3b82f6' },
  { id: 'cat-3',  nombre: 'Gasolina y Peajes',        palabrasClave: ['GASOLINA', 'PEAJE', 'REPSOL', 'BP'],          color: '#f59e0b' },
  { id: 'cat-4',  nombre: 'Luz',                      palabrasClave: ['ENDESA', 'IBERDROLA', 'NATURGY'],             color: '#fbbf24' },
  { id: 'cat-5',  nombre: 'Agua',                     palabrasClave: ['CANAL DE ISABEL', 'AGUAS DE'],               color: '#06b6d4' },
  { id: 'cat-6',  nombre: 'Teléfono',                 palabrasClave: ['MOVISTAR', 'VODAFONE', 'ORANGE', 'YOIGO'],   color: '#8b5cf6' },
  { id: 'cat-7',  nombre: 'Seguros',                  palabrasClave: ['MUTUA', 'MAPFRE', 'ADESLAS', 'ASISA'],       color: '#ec4899' },
  { id: 'cat-8',  nombre: 'Educación',                palabrasClave: ['COLEGIO', 'ESCUELA', 'ACADEMIA'],            color: '#14b8a6' },
  { id: 'cat-9',  nombre: 'Restaurantes',             palabrasClave: ['RESTAURANTE', 'CAFETERIA', 'BAR '],          color: '#f97316' },
  { id: 'cat-10', nombre: 'Amazon',                   palabrasClave: ['AMAZON'],                                    color: '#ff9900' },
  { id: 'cat-11', nombre: 'Plataformas',              palabrasClave: ['NETFLIX', 'SPOTIFY', 'HBO', 'DISNEY'],       color: '#e11d48' },
  { id: 'cat-12', nombre: 'Farmacia',                 palabrasClave: ['FARMACIA'],                                  color: '#22c55e' },
  { id: 'cat-13', nombre: 'Médico',                   palabrasClave: ['CLINICA', 'MEDICO', 'HOSPITAL'],             color: '#ef4444' },
  { id: 'cat-14', nombre: 'Ingresos',                 palabrasClave: ['NOMINA', 'TRANSFERENCIA RECIBIDA'],          color: '#16a34a', esIngreso: true },
  { id: 'cat-15', nombre: 'Otros',                    palabrasClave: [],                                            color: '#94a3b8' },
  { id: 'cat-16', nombre: 'Transferencias internas',  palabrasClave: ['TRANSF INTERNA', 'TRASPASO'],                color: '#cbd5e1', esTransferencia: true },
]

const useCategoryStore = create((set, get) => ({
  categories: [],
  loaded: false,

  loadFromDB: async () => {
    const stored = await db.categories.toArray()
    if (stored.length === 0) {
      // First run: seed defaults
      await db.categories.bulkPut(DEFAULT_CATEGORIES)
      set({ categories: DEFAULT_CATEGORIES, loaded: true })
    } else {
      // Ensure flags exist (migration for existing records)
      const migrated = stored.map((c) => {
        const updated = { ...c }
        if (c.id === 'cat-14' && !c.esIngreso) updated.esIngreso = true
        if (c.id === 'cat-16' && !c.esTransferencia) updated.esTransferencia = true
        return updated
      })
      // If anything changed, persist migrations
      const changed = migrated.filter((c, i) => JSON.stringify(c) !== JSON.stringify(stored[i]))
      if (changed.length > 0) await db.categories.bulkPut(changed)
      // Ensure transfer + ingreso categories exist
      if (!migrated.find((c) => c.esTransferencia)) {
        const tc = DEFAULT_CATEGORIES.find((c) => c.esTransferencia)
        await db.categories.put(tc)
        migrated.push(tc)
      }
      if (!migrated.find((c) => c.esIngreso)) {
        const ic = DEFAULT_CATEGORIES.find((c) => c.esIngreso)
        await db.categories.put(ic)
        migrated.push(ic)
      }
      set({ categories: migrated, loaded: true })
    }
  },

  addCategory: async (category) => {
    const newCat = { ...category, id: `cat-${Date.now()}` }
    await db.categories.put(newCat)
    set((state) => ({ categories: [...state.categories, newCat] }))
  },

  updateCategory: async (id, updates) => {
    await db.categories.update(id, updates)
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }))
  },

  reorderCategories: async (fromIndex, toIndex) => {
    set((state) => {
      const cats = [...state.categories]
      const [moved] = cats.splice(fromIndex, 1)
      cats.splice(toIndex, 0, moved)
      // Persist all with updated order field
      const withOrder = cats.map((c, i) => ({ ...c, _order: i }))
      db.categories.bulkPut(withOrder)
      return { categories: withOrder }
    })
  },

  deleteCategory: async (id) => {
    await db.categories.delete(id)
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }))
  },

  getCategoryById: (id) => get().categories.find((c) => c.id === id),
  getCategoryByName: (name) => get().categories.find((c) => c.nombre === name),
}))

export default useCategoryStore
