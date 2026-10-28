import { create } from 'zustand'
import db, { live, softDelete } from '../db/db'
import { newId } from '../db/ids'

// Subcategorías iniciales: se crean una sola vez (también en instalaciones existentes),
// solo si existen su categoría y su cuenta destino, y no se vuelven a crear si el usuario las borra.
const SEED_KEY = 'cuadra.seed.subcategories'
const DEFAULT_SUBCATEGORIES = [
  // Sacar dinero del cajero = traspaso del banco a la cuenta Efectivo (no es gasto)
  { id: 'subcat-cajero', categoriaId: 'cat-16', nombre: 'Cajero', palabrasClave: ['CAJERO'], color: '#94a3b8', cuentaDestinoId: 'acc-2' },
]

const useSubcategoryStore = create((set) => ({
  subcategories: [],
  loaded: false,

  loadFromDB: async () => {
    let subcategories = await live(db.subcategories)
    let seeded = false
    try { seeded = localStorage.getItem(SEED_KEY) === '1' } catch { /* sin almacenamiento */ }
    if (!seeded) {
      const [catIds, accIds] = (await Promise.all([live(db.categories), live(db.accounts)])).map((list) => list.map((r) => r.id))
      const toAdd = DEFAULT_SUBCATEGORIES.filter((s) =>
        catIds.includes(s.categoriaId) && (!s.cuentaDestinoId || accIds.includes(s.cuentaDestinoId)) &&
        !subcategories.some((x) => x.id === s.id))
      if (toAdd.length) {
        await db.subcategories.bulkPut(toAdd)
        subcategories = [...subcategories, ...toAdd]
      }
      if (catIds.length) { try { localStorage.setItem(SEED_KEY, '1') } catch { /* sin almacenamiento */ } }
    }
    set({ subcategories, loaded: true })
  },

  addSubcategory: async (subcat) => {
    const newSub = { ...subcat, id: newId() }
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
    await softDelete(db.subcategories, [id])
    set((state) => ({ subcategories: state.subcategories.filter((s) => s.id !== id) }))
  },
}))

export default useSubcategoryStore
