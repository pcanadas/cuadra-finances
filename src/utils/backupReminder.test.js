import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { shouldRemindBackup, markBackupDone, snoozeBackupReminder, daysSinceBackup } from './backupReminder'

const DAY = 86_400_000

describe('backup reminder', () => {
  beforeEach(() => {
    const store = {}
    vi.stubGlobal('localStorage', {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v) },
    })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-23T10:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('never reminds without data', () => {
    expect(shouldRemindBackup(false)).toBe(false)
  })

  it('first reminder after a week using the app', () => {
    expect(shouldRemindBackup(true)).toBe(false) // empieza a contar hoy
    vi.setSystemTime(Date.now() + 8 * DAY)
    expect(shouldRemindBackup(true)).toBe(true)
    expect(daysSinceBackup()).toBeNull()
  })

  it('after a backup, waits a month', () => {
    shouldRemindBackup(true)
    vi.setSystemTime(Date.now() + 8 * DAY)
    markBackupDone()
    expect(shouldRemindBackup(true)).toBe(false)
    vi.setSystemTime(Date.now() + 31 * DAY)
    expect(shouldRemindBackup(true)).toBe(true)
    expect(daysSinceBackup()).toBe(31)
  })

  it('"Ahora no" hides it for a week', () => {
    shouldRemindBackup(true)
    vi.setSystemTime(Date.now() + 8 * DAY)
    snoozeBackupReminder()
    expect(shouldRemindBackup(true)).toBe(false)
    vi.setSystemTime(Date.now() + 8 * DAY)
    expect(shouldRemindBackup(true)).toBe(true)
  })
})
