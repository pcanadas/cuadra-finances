import { useEffect, useMemo, useState } from 'react'
import InfoPage from '../components/InfoPage'

const SOURCE_LABEL = { npm: 'Interfaz', rust: 'Núcleo nativo', android: 'Android' }

function Row({ pkg, text }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="border-b border-slate-100 last:border-b-0">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 py-2.5 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-slate-800 truncate">{pkg.name}</span>
          <span className="block text-xs text-slate-400">{pkg.version} · {pkg.license}</span>
        </span>
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && (
        <pre className="mb-3 p-3 bg-slate-50 rounded-lg text-[11px] leading-snug text-slate-600 whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
          {text ?? 'Texto de licencia no disponible.'}
        </pre>
      )}
    </li>
  )
}

// Licencias del código de terceros incluido en la app (generado con `npm run licenses`)
export default function Licencias() {
  const [data, setData] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    import('../assets/licenses.json').then((m) => setData(m.default))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return q ? data.packages.filter((p) => p.name.toLowerCase().includes(q) || p.license.toLowerCase().includes(q)) : data.packages
  }, [data, query])

  return (
    <InfoPage title="Licencias de terceros">
      <p className="text-sm text-slate-600 px-1">
        Zenit se construye con software de código abierto. Gracias a sus autores. Estas son las librerías que incluye y sus licencias.
      </p>
      {!data ? (
        <p className="text-sm text-slate-400 px-1">Cargando…</p>
      ) : (
        <>
          <input type="search" placeholder={`Buscar entre ${data.packages.length} librerías…`} value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          {['npm', 'rust', 'android'].map((source) => {
            const items = filtered.filter((p) => p.source === source)
            if (!items.length) return null
            return (
              <section key={source}>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1 mb-1.5">
                  {SOURCE_LABEL[source]} · {items.length}
                </h2>
                <ul className="bg-white rounded-xl border border-slate-200 shadow-sm px-4">
                  {items.map((p) => <Row key={`${p.name}@${p.version}`} pkg={p} text={data.texts[p.text]} />)}
                </ul>
              </section>
            )
          })}
        </>
      )}
    </InfoPage>
  )
}
