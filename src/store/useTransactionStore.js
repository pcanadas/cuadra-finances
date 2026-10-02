import { create } from 'zustand'
import db from '../db/db'

const useTransactionStore = create((set, get) => ({
  transactions: [],
  loaded: false,

  loadFromDB: async () => {
    const transactions = await db.transactions.toArray()
    set({ transactions, loaded: true })
  },

  addTransactions: async (newTransactions) => {
    const existing = get().transactions
    const existingIds = new Set(existing.map((t) => t.id))
    // Content fingerprint: same date + description + amount = duplicate
    const existingFingerprints = new Set(
      existing.map((t) => `${t.fechaContable}|${t.descripcion}|${t.importe}`)
    )
    const unique = newTransactions.filter((t) => {
      if (existingIds.has(t.id)) return false
      if (existingFingerprints.has(`${t.fechaContable}|${t.descripcion}|${t.importe}`)) return false
      return true
    })
    if (unique.length === 0) return 0
    await db.transactions.bulkPut(unique)
    set((state) => ({ transactions: [...state.transactions, ...unique] }))
    return unique.length
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

  deleteTransaction: async (id) => {
    await db.transactions.delete(id)
    set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) }))
  },

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
