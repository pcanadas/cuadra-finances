// Recordatorio de copia de seguridad (Inicio, móvil). Todo se guarda por dispositivo.
const LAST_BACKUP_KEY = 'cuadra.lastBackupAt'
const SNOOZE_KEY = 'cuadra.backupReminderSnoozedAt'
const FIRST_DATA_KEY = 'cuadra.firstDataAt'

const DAY = 86_400_000
const REMIND_AFTER_DAYS = 30   // sin copia desde hace un mes
const FIRST_AFTER_DAYS = 7     // la primera vez, tras una semana usando la app
const SNOOZE_DAYS = 7          // «Ahora no» lo oculta una semana

const read = (k) => { try { return Number(localStorage.getItem(k)) || 0 } catch { return 0 } }
const write = (k, v) => { try { localStorage.setItem(k, String(v)) } catch { /* sin almacenamiento */ } }

export function markBackupDone() {
  write(LAST_BACKUP_KEY, Date.now())
}

export function snoozeBackupReminder() {
  write(SNOOZE_KEY, Date.now())
}

/** Días desde la última copia (null si nunca se ha hecho). */
export function daysSinceBackup() {
  const last = read(LAST_BACKUP_KEY)
  return last ? Math.floor((Date.now() - last) / DAY) : null
}

export function shouldRemindBackup(hasData) {
  if (!hasData) return false
  const now = Date.now()
  let first = read(FIRST_DATA_KEY)
  if (!first) { first = now; write(FIRST_DATA_KEY, now) }
  if (now - read(SNOOZE_KEY) < SNOOZE_DAYS * DAY) return false
  const last = read(LAST_BACKUP_KEY)
  return last ? now - last > REMIND_AFTER_DAYS * DAY : now - first > FIRST_AFTER_DAYS * DAY
}
