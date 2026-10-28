import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import db, { live, replaceAllData, softDelete } from './db'
import { newId } from './ids'
import { nextHlc } from './hlc'
import useTransactionStore from '../store/useTransactionStore'

const row = (over = {}) => ({ id: newId(), fechaContable: '2026-10-01', descripcion: 'MERCADONA', importe: -20, saldo: 100, accountId: 'acc-1', ...over })

describe('ids y reloj', () => {
  it('newId es un UUID v7 ordenado por tiempo', () => {
    const a = newId(1000), b = newId(2000)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(a < b).toBe(true)
  })

  it('el hlc nunca retrocede, aunque el reloj lo haga', () => {
    const a = nextHlc(5_000_000_000_000), b = nextHlc(5_000_000_000_000), c = nextHlc(4_000_000_000_000)
    expect(a < b && b < c).toBe(true)
  })
})

describe('escrituras', () => {
  it('cada registro nuevo lleva marca de tiempo, origen e importHash', async () => {
    const t = row()
    await db.transactions.put(t)
    const saved = await db.transactions.get(t.id)
    expect(saved.origen).toBe('importado')
    expect(saved.importHash).toBeTruthy()
    expect(saved.hlc).toBeTruthy()
    await db.categories.put({ id: 'cat-x', nombre: 'X' })
    expect((await db.categories.get('cat-x')).hlc).toBeTruthy()
  })

  it('editar actualiza la marca y el importHash', async () => {
    const t = row()
    await db.transactions.put(t)
    const before = await db.transactions.get(t.id)
    await db.transactions.update(t.id, { descripcion: 'MERCADONA SA' })
    const after = await db.transactions.get(t.id)
    expect(after.hlc > before.hlc).toBe(true)
    expect(after.importHash).not.toBe(before.importHash)
  })

  it('un bulkPut con datos viejos del store no hace retroceder la marca', async () => {
    const t = row()
    await db.transactions.put(t)
    const stale = await db.transactions.get(t.id)
    await db.transactions.update(t.id, { categoria: 'cat-1' })
    const fresh = await db.transactions.get(t.id)
    await db.transactions.bulkPut([{ ...stale, categoria: 'cat-2' }])
    expect((await db.transactions.get(t.id)).hlc > fresh.hlc).toBe(true)
  })
})

describe('borrados', () => {
  it('dejan una lápida sin el contenido y desaparecen de las lecturas', async () => {
    const t = row({ descripcion: 'FARMACIA' })
    await db.transactions.put(t)
    await softDelete(db.transactions, [t.id])
    const stone = await db.transactions.get(t.id)
    expect(stone.deletedAt).toBeTypeOf('number')
    expect(stone.descripcion).toBeUndefined()
    expect(stone.importe).toBeUndefined()
    expect(stone.hlc).toBeTruthy()
    expect((await live(db.transactions)).some((x) => x.id === t.id)).toBe(false)
  })

  it('el store borra con lápida y crea los manuales con UUID', async () => {
    const store = useTransactionStore.getState()
    await store.loadFromDB()
    await store.addManualTransaction({ fechaContable: '2026-10-02', descripcion: 'Café', importe: -1.5, accountId: 'acc-2' })
    const manual = useTransactionStore.getState().transactions.at(-1)
    expect(manual.id).toMatch(/^[0-9a-f-]{36}$/)
    expect((await db.transactions.get(manual.id)).origen).toBe('manual')
    await useTransactionStore.getState().deleteTransaction(manual.id)
    expect((await db.transactions.get(manual.id)).deletedAt).toBeTypeOf('number')
    await useTransactionStore.getState().loadFromDB()
    expect(useTransactionStore.getState().transactions.some((x) => x.id === manual.id)).toBe(false)
  })
})

describe('restaurar una copia', () => {
  it('sustituye todo, sin lápidas, y completa los datos de versiones anteriores', async () => {
    await softDelete(db.transactions, [(await live(db.transactions))[0].id])
    await replaceAllData({
      transactions: [
        { id: 'tx-1600000000000-0-a', fechaContable: '2020-01-01', descripcion: 'LUZ', importe: -50, saldo: 10 },
        { id: 'tx-manual-1600000000000-b', esManual: true, fechaContable: '2020-01-02', descripcion: 'Café', importe: -1 },
      ],
      categories: [{ id: 'cat-1', nombre: 'Alimentación' }],
      accounts: [{ id: 'acc-1', nombre: 'Banco' }],
    })
    const all = await db.transactions.toArray()
    expect(all.map((t) => t.id).sort()).toEqual(['tx-1600000000000-0-a', 'tx-manual-1600000000000-b'])
    expect(all.find((t) => t.esManual).origen).toBe('manual')
    expect(all.find((t) => !t.esManual)).toMatchObject({ origen: 'importado', importId: 1600000000000 })
    expect(await db.budgets.count()).toBe(0)
  })
})
