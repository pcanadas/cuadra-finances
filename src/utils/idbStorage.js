/**
 * IndexedDB storage adapter for Zustand persist middleware.
 * Must be used with createJSONStorage() — Zustand handles JSON serialization,
 * this module only deals with raw strings.
 *
 * Usage in store:
 *   import { persist, createJSONStorage } from 'zustand/middleware'
 *   import { idbStorage } from '../utils/idbStorage'
 *   persist(fn, { name: 'key', storage: createJSONStorage(() => idbStorage) })
 */

const DB_NAME = 'cuadra-finances'
const DB_VERSION = 1
const STORE_NAME = 'zustand'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME)
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror = (e) => { dbPromise = null; reject(e.target.error) }
  })
  return dbPromise
}

function idbGet(key) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key)
        req.onsuccess = () => resolve(req.result ?? null)
        req.onerror = () => reject(req.error)
      })
  )
}

function idbSet(key, value) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
  )
}

function idbDel(key) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(key)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
  )
}

// StateStorage interface (string-based) — used with createJSONStorage()
export const idbStorage = {
  getItem: async (name) => {
    try {
      const value = await idbGet(name)

      // Value found in IndexedDB
      if (value !== null) {
        // If it was stored as an object by the old (broken) migration, re-serialize it
        if (typeof value !== 'string') {
          const str = JSON.stringify(value)
          await idbSet(name, str) // fix it in place
          return str
        }
        return value
      }

      // Nothing in IndexedDB — try to migrate from localStorage
      const lsValue = localStorage.getItem(name)
      if (lsValue !== null) {
        await idbSet(name, lsValue) // store the JSON string as-is
        // Keep localStorage copy until next successful write (safer)
        console.info(`[storage] Migrated "${name}" localStorage → IndexedDB`)
        return lsValue
      }

      return null
    } catch (err) {
      console.error(`[storage] getItem "${name}" failed:`, err)
      // Fall back to localStorage if IndexedDB is unavailable
      return localStorage.getItem(name)
    }
  },

  setItem: async (name, value) => {
    try {
      await idbSet(name, value)
      // Only remove localStorage copy after a confirmed IDB write
      localStorage.removeItem(name)
    } catch (err) {
      console.error(`[storage] setItem "${name}" failed, falling back to localStorage:`, err)
      try { localStorage.setItem(name, value) } catch { /* quota exceeded */ }
    }
  },

  removeItem: async (name) => {
    try { await idbDel(name) } catch { /* ignore */ }
    localStorage.removeItem(name)
  },
}
