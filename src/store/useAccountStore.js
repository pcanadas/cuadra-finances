import { create } from 'zustand'
import db from '../db/db'

const DEFAULT_ACCOUNTS = [
  { id: 'acc-1', nombre: 'Cuenta principal', tipo: 'banco',    color: '#6366f1' },
  { id: 'acc-2', nombre: 'Efectivo',          tipo: 'efectivo', color: '#10b981' },
]

const useAccountStore = create((set, get) => ({
  accounts: [],
  loaded: false,

  loadFromDB: async () => {
    const stored = await db.accounts.toArray()
    if (stored.length === 0) {
      await db.accounts.bulkPut(DEFAULT_ACCOUNTS)
      set({ accounts: DEFAULT_ACCOUNTS, loaded: true })
    } else {
      set({ accounts: stored, loaded: true })
    }
  },

  addAccount: async (account) => {
    const newAccount = { ...account, id: `acc-${Date.now()}` }
    await db.accounts.put(newAccount)
    set((s) => ({ accounts: [...s.accounts, newAccount] }))
  },

  updateAccount: async (id, updates) => {
    await db.accounts.update(id, updates)
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }))
  },

  deleteAccount: async (id) => {
    await db.accounts.delete(id)
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }))
  },
}))

export default useAccountStore
