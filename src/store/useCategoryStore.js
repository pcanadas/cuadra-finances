import { create } from 'zustand'
import db, { live, softDelete } from '../db/db'
import { newId } from '../db/ids'

// Categorías iniciales (solo se crean en una instalación nueva).
// La categorización usa la PRIMERA categoría cuya palabra clave aparece en el concepto,
// así que evita palabras cortas que formen parte de otras: rodéalas de espacios para exigir la palabra
// completa (' IBI ' no coincide con «RECIBIDO»).
const DEFAULT_CATEGORIES = [
  { id: 'cat-1',  nombre: 'Alimentación',            palabrasClave: ['MERCADONA', 'CARREFOUR', 'SUPERMERCADO', 'LIDL', ' DIA ', 'ALCAMPO', 'EROSKI'], color: '#10b981' },
  { id: 'cat-2',  nombre: 'Deportes',                palabrasClave: ['GIMNASIO', 'DECATHLON'],                         color: '#3b82f6' },
  { id: 'cat-3',  nombre: 'Gasolina y Peajes',       palabrasClave: ['GASOLINA', 'PEAJE', 'REPSOL', 'BP', 'CEPSA'],   color: '#f59e0b' },
  { id: 'cat-4',  nombre: 'Luz',                     palabrasClave: ['ENDESA', 'IBERDROLA', 'NATURGY'],               color: '#fbbf24' },
  { id: 'cat-5',  nombre: 'Agua',                    palabrasClave: ['CANAL DE ISABEL', 'AGUAS DE'],                  color: '#06b6d4' },
  { id: 'cat-6',  nombre: 'Teléfono',                palabrasClave: ['MOVISTAR', 'VODAFONE', 'ORANGE', 'YOIGO'],      color: '#8b5cf6' },
  { id: 'cat-7',  nombre: 'Seguros',                 palabrasClave: ['MUTUA', 'MAPFRE', 'ADESLAS', 'ASISA'],          color: '#ec4899' },
  { id: 'cat-8',  nombre: 'Educación',               palabrasClave: ['COLEGIO', 'ESCUELA', 'ACADEMIA'],               color: '#14b8a6' },
  { id: 'cat-9',  nombre: 'Ocio',                    palabrasClave: ['RESTAURANTE', 'CAFETERIA', ' BAR ', 'CINE'],     color: '#f97316' },
  { id: 'cat-10', nombre: 'Amazon',                  palabrasClave: ['AMAZON'],                                       color: '#ff9900' },
  { id: 'cat-11', nombre: 'Plataformas',             palabrasClave: ['NETFLIX', 'SPOTIFY', 'HBO', 'DISNEY'],          color: '#e11d48' },
  { id: 'cat-12', nombre: 'Farmacia',                palabrasClave: ['FARMACIA'],                                     color: '#22c55e' },
  { id: 'cat-13', nombre: 'Médico',                  palabrasClave: ['CLINICA', 'MEDICO', 'HOSPITAL'],                palabrasExcluidas: ['VETERINARI'], color: '#ef4444' },
  { id: 'cat-14', nombre: 'Ingresos',                palabrasClave: ['NOMINA', 'TRANSFERENCIA RECIBIDA'],             color: '#16a34a', esIngreso: true },
  { id: 'cat-15', nombre: 'Otros',                   palabrasClave: [],                                               color: '#94a3b8' },
  { id: 'cat-16', nombre: 'Transferencias internas', palabrasClave: ['TRANSF INTERNA', 'TRASPASO', 'CAJERO'],         color: '#cbd5e1', esTransferencia: true },
  { id: 'cat-17', nombre: 'SS / Autónomos',          palabrasClave: ['COTIZACION', 'TESORERIA', 'SEG SOCIAL', 'SEGURIDAD SOCIAL'], color: '#78716c' },
  { id: 'cat-18', nombre: 'Transportes',             palabrasClave: ['TAXI', 'RENFE', ' TREN ', 'AUTOBUS', 'METRO', 'CABIFY'], color: '#0ea5e9' },
  { id: 'cat-19', nombre: 'Vivienda',                palabrasClave: ['ALQUILER', 'HIPOTECA', 'PRESTAMO HIPOT', 'COMUNIDAD DE PROPIETARIOS', 'COMUNIDAD PROP', 'CDAD PROP', 'CC.PP', 'CCPP'], color: '#a16207' },
  { id: 'cat-20', nombre: 'Impuestos',               palabrasClave: ['AGENCIA TRIBUTARIA', 'AEAT', 'HACIENDA', 'DECLARACION RENTA', 'IRPF', 'IMPUESTO', 'I.B.I', ' IBI ', 'CIRCULACION', 'IVTM'], color: '#475569' },
  { id: 'cat-21', nombre: 'Coche',                   palabrasClave: ['ITV', 'TALLER', 'NEUMATIC'],                    color: '#84cc16' },
  { id: 'cat-22', nombre: 'Mascotas',                palabrasClave: ['VETERINARI', 'CLINICA VET', 'TIENDANIMAL', 'KIWOKO', 'MASCOTA'], color: '#d946ef' },
]

const useCategoryStore = create((set, get) => ({
  categories: [],
  loaded: false,

  loadFromDB: async () => {
    const stored = await live(db.categories)
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
    const newCat = { ...category, id: newId() }
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
    await softDelete(db.categories, [id])
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }))
  },

  getCategoryById: (id) => get().categories.find((c) => c.id === id),
  getCategoryByName: (name) => get().categories.find((c) => c.nombre === name),
}))

export default useCategoryStore
