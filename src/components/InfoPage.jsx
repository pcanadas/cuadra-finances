// Página de texto (Ayuda, Términos, Privacidad): título, fecha y secciones.

export function InfoSection({ title, children }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      {title && <h2 className="text-sm font-semibold text-slate-800 mb-2">{title}</h2>}
      <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

export default function InfoPage({ title, updated, children }) {
  return (
    <div className="max-w-2xl space-y-3">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        {updated && <p className="text-xs text-slate-400 mt-0.5">Última actualización: {updated}</p>}
      </div>
      {children}
    </div>
  )
}
