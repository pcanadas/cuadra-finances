import { create } from 'zustand'
import db, { live, softDelete } from '../db/db'
import { newId } from '../db/ids'
import { planImport } from '../utils/bankBalance'
import { planTransferSync } from '../utils/transferPairing'

const useTransactionStore = create((set, get) => ({
  transactions: [],
  loaded: false,

  loadFromDB: async () => {
    const transactions = await live(db.transactions)
    set({ transactions, loaded: true })
  },

  /**
   * Importa filas de un extracto sin duplicar lo que ya existe (ver planImport): los repetidos
   * se saltan y los pendientes que el banco ya ha contabilizado se completan con su saldo.
   * @returns {Promise<{ added: number, updated: number }>}
   */
  addTransactions: async (newTransactions, defaultAccountId = null) => {
    const existing = get().transactions
    const ids = new Set(existing.map((t) => t.id))
    const { add, update } = planImport(existing, newTransactions.filter((t) => !ids.has(t.id)), defaultAccountId)
    if (!add.length && !update.length) return { added: 0, updated: 0 }
    const changes = new Map(update.map((u) => [u.id, u.changes]))
    await db.transaction('rw', db.transactions, async () => {
      if (add.length) await db.transactions.bulkPut(add)
      for (const { id, changes: c } of update) await db.transactions.update(id, c)
    })
    set((state) => ({
      transactions: [...state.transactions.map((t) => (changes.has(t.id) ? { ...t, ...changes.get(t.id) } : t)), ...add],
    }))
    return { added: add.length, updated: update.length }
  },

  updateTransaction: async (id, updates) => {
    await db.transactions.update(id, updates)
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
  },

  bulkUpdateTransactions: async (updatesMap) => {
    const toWrite = get().transactions
      .filter((t) => updatesMap[t.id])
      .map((t) => ({ ...t, ...updatesMap[t.id] }))
    if (toWrite.length === 0) return
    await db.transactions.bulkPut(toWrite)
    set((state) => ({
      transactions: state.transactions.map((t) =>
        updatesMap[t.id] ? { ...t, ...updatesMap[t.id] } : t
      ),
    }))
  },

  addManualTransaction: async (tx) => {
    const newTx = {
      ...tx,
      id: newId(),
      esManual: true,
      origen: 'manual',
    }
    await db.transactions.put(newTx)
    set((state) => ({ transactions: [...state.transactions, newTx] }))
  },

  deleteTransaction: async (id) => {
    await softDelete(db.transactions, [id])
    set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) }))
  },

  /**
   * Contrapartidas de los traspasos al día con la cuenta destino de cada categoría/subcategoría
   * (ver planTransferSync). Llamar tras cambiar esas categorías.
   * @returns {Promise<{ created: number, linked: number, removed: number }>}
   */
  syncTransferCounterparts: async (categories, subcategories, accounts) => {
    const { add, update, remove } = planTransferSync(get().transactions, categories, subcategories, accounts)
    if (!add.length && !update.length && !remove.length) return { created: 0, linked: 0, removed: 0 }
    const changes = new Map(update.map((u) => [u.id, u.changes]))
    await db.transaction('rw', db.transactions, async () => {
      await softDelete(db.transactions, remove)
      for (const { id, changes: c } of update) await db.transactions.update(id, c)
      if (add.length) await db.transactions.bulkPut(add)
    })
    const removed = new Set(remove)
    set((state) => ({
      transactions: [
        ...state.transactions.filter((t) => !removed.has(t.id)).map((t) => (changes.has(t.id) ? { ...t, ...changes.get(t.id) } : t)),
        ...add,
      ],
    }))
    // Emparejados con un movimiento real de la cuenta destino (ni creados ni el propio origen)
    const linked = update.filter((u) => u.changes.categoria !== undefined).length
    return { created: add.length, linked, removed: remove.length }
  },

  deleteTransactions: async (ids) => {
    const remove = new Set(ids)
    await softDelete(db.transactions, [...remove])
    set((state) => ({ transactions: state.transactions.filter((t) => !remove.has(t.id)) }))
  },

  // «Borrar todos los datos»: borrado completo, sin lápidas
  clearAll: async () => {
    await db.transactions.clear()
    set({ transactions: [] })
  },

  getByMonth: (year, month) =>
    get().transactions.filter((t) => {
      const d = new Date(t.fechaContable)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    }),
}))

export default useTransactionStore
