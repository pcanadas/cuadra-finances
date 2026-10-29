import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import useCategoryStore from '../store/useCategoryStore'
import { useBackHandler } from '../platform/back'
import { isMobile } from '../platform'
import { getCategoryIcon, ICON_GROUPS } from '../utils/categoryIcons'
import { NOTIFY_EVENT, hasQuickAddNotification, getQuickAddNotification, setQuickAddNotification, openNotificationSettings } from '../platform/notifications'
import { TEXT_SIZE_MIN, TEXT_SIZE_MAX, TEXT_SIZE_STEP, getTextSize, getSystemTextSize, setTextSize } from '../platform/textSize'
import { canUseAppLock, isAppLockEnabled, setAppLockEnabled, getLockDelay, setLockDelay, LOCK_DELAYS, authenticateUser, biometryName } from '../platform/appLock'
import SelectSheet from '../components/SelectSheet'

// ─── Selector de icono (hoja inferior) ──────────────────────────────────────

function IconPicker({ category, onPick, onClose }) {
  useBackHandler(true, onClose)

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 max-h-[80vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(1rem + var(--sab))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="w-10 h-10 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: category.color + '26' }}>
            {getCategoryIcon(category)}
          </span>
          <h2 className="text-base font-semibold text-slate-800">{category.nombre}</h2>
        </div>
        {ICON_GROUPS.map((g) => (
          <div key={g.nombre} className="mb-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{g.nombre}</p>
            <div className="grid grid-cols-8 gap-1">
              {g.iconos.map((icon) => (
                <button key={icon} onClick={() => onPick(icon)}
                  className={`aspect-square rounded-lg text-2xl flex items-center justify-center ${
                    getCategoryIcon(category) === icon ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'hover:bg-slate-100 active:bg-slate-100'
                  }`}>
                  {icon}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────

// Notificación fija con «+ Gasto» / «+ Ingreso» (solo Android)
function QuickAddNotificationSetting() {
  const [state, setState] = useState(getQuickAddNotification)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    const refresh = () => setState(getQuickAddNotification())
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() } // al volver de los ajustes del móvil
    window.addEventListener(NOTIFY_EVENT, refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener(NOTIFY_EVENT, refresh); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  function toggle() {
    setTried(true)
    setQuickAddNotification(!state.enabled)
  }

  const on = state.enabled && state.allowed
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Botones en la barra de notificaciones</h2>
          <p className="text-xs text-slate-500 mt-1">«+ Gasto» y «+ Ingreso» siempre a mano para apuntar al momento, sin buscar la app.</p>
        </div>
        <button role="switch" aria-checked={on} onClick={toggle} aria-label="Botones en la barra de notificaciones"
          className={`relative w-12 h-7 shrink-0 rounded-full transition-colors ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}>
          <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
        </button>
      </div>
      {!state.allowed && (tried || state.enabled) && (
        <p className="text-xs text-amber-700 mt-3">
          Las notificaciones de la app están desactivadas en tu móvil.{' '}
          <button onClick={openNotificationSettings} className="font-semibold underline">Activarlas en Ajustes del móvil</button>
        </p>
      )}
      <p className="text-xs text-slate-400 mt-3">También puedes mantener pulsado el icono de la app para «Nuevo gasto» o «Nuevo ingreso».</p>
    </section>
  )
}

/** Bloqueo con huella/cara o el bloqueo de pantalla del móvil (solo Android). */
function AppLockSetting() {
  const [on, setOn] = useState(isAppLockEnabled)
  const [delay, setDelay] = useState(getLockDelay)
  const [bio, setBio] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => { biometryName().then(setBio) }, [])

  // Activarlo y desactivarlo también piden identificarse
  async function toggle() {
    setMessage(null)
    const { ok, code } = await authenticateUser(on ? 'Desactivar el bloqueo de Zenit' : 'Activar el bloqueo de Zenit')
    if (ok) {
      setAppLockEnabled(!on)
      setOn(!on)
    } else if (code === 'passcodeNotSet') {
      setMessage('Tu móvil no tiene bloqueo de pantalla. Configura un PIN, patrón o huella en los ajustes de Android y vuelve a intentarlo.')
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">🔒 Bloquear Zenit</h2>
          <p className="text-xs text-slate-500 mt-1">
            Pide {bio ? `tu ${bio} o ` : ''}el PIN, patrón o contraseña del móvil al abrir Zenit. Zenit no guarda ninguna contraseña ni huella: lo comprueba Android.
          </p>
        </div>
        <button role="switch" aria-checked={on} onClick={toggle} aria-label="Bloquear Zenit"
          className={`relative w-12 h-7 shrink-0 rounded-full transition-colors ${on ? 'bg-indigo-600' : 'bg-slate-300'}`}>
          <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
        </button>
      </div>
      {message && <p className="text-xs text-amber-700 mt-3">{message}</p>}
      {on && (
        <div className="flex items-center justify-between gap-3 mt-3">
          <span className="text-xs text-slate-500">Cuándo pedirlo</span>
          <SelectSheet title="Cuándo pedirlo" value={String(delay)} className="text-xs"
            onChange={(v) => { setDelay(Number(v)); setLockDelay(Number(v)) }}
            options={LOCK_DELAYS.map((d) => ({ value: String(d.value), label: d.label }))} />
        </div>
      )}
    </section>
  )
}

export default function Ajustes() {
  const { dark, setDark } = useTheme()
  const categories = useCategoryStore((s) => s.categories)
  const updateCategory = useCategoryStore((s) => s.updateCategory)
  const [editingId, setEditingId] = useState(null)
  const [textSize, setTextSizeState] = useState(getTextSize)
  const systemSize = getSystemTextSize()

  function changeTextSize(v) {
    setTextSizeState(v)
    setTextSize(v)
  }

  const sorted = [...categories].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const editing = categories.find((c) => c.id === editingId)

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl lg:text-2xl font-bold text-slate-800">Ajustes</h1>

      {canUseAppLock && <AppLockSetting />}

      {/* Escritorio: el tema se cambia en la barra superior */}
      {isMobile && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Apariencia</h2>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            {[{ v: false, label: '☀️ Claro' }, { v: true, label: '🌙 Oscuro' }].map(({ v, label }) => (
              <button key={label} onClick={() => setDark(v)}
                className={`py-2.5 rounded-lg text-sm font-semibold ${dark === v ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Tamaño de letra</h2>
          <span className="text-sm font-semibold text-indigo-600 tabular-nums">{textSize} %</span>
        </div>
        <p className="text-sm text-slate-600 my-3">Así se verá el texto en la aplicación.</p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">A</span>
          <input type="range" min={TEXT_SIZE_MIN} max={TEXT_SIZE_MAX} step={TEXT_SIZE_STEP} value={textSize}
            onChange={(e) => changeTextSize(Number(e.target.value))}
            className="flex-1 accent-indigo-600" aria-label="Tamaño de letra" />
          <span className="text-xl text-slate-500">A</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs">
          {textSize === systemSize ? (
            <span className="text-emerald-600">✓ {isMobile ? 'Igual que la letra de tu móvil' : 'Tamaño estándar'}</span>
          ) : (
            <>
              <span className="text-slate-500">{isMobile ? `Tu móvil usa ${systemSize} %` : `Estándar: ${systemSize} %`}</span>
              <button onClick={() => changeTextSize(systemSize)} className="font-medium text-indigo-600">
                {isMobile ? 'Volver al del móvil' : 'Volver al estándar'}
              </button>
            </>
          )}
        </div>
      </section>

      {hasQuickAddNotification() && <QuickAddNotificationSetting />}

      {/* Los iconos solo se usan en el alta rápida del móvil */}
      {isMobile && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-700">Iconos de categorías</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-3">Se muestran al añadir movimientos. Toca una categoría para cambiar su icono.</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {sorted.map((c) => (
              <button key={c.id} onClick={() => setEditingId(c.id)}
                className="flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-slate-50 active:bg-slate-50">
                <span className="w-11 h-11 rounded-full flex items-center justify-center text-2xl"
                  style={{ backgroundColor: c.color + '26' }}>
                  {getCategoryIcon(c)}
                </span>
                <span className="text-[11px] leading-tight text-slate-600 text-center line-clamp-2">{c.nombre}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {editing && (
        <IconPicker
          category={editing}
          onPick={async (icono) => { await updateCategory(editing.id, { icono }); setEditingId(null) }}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  )
}
