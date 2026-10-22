import { useState } from 'react'
import useTransactionStore from '../store/useTransactionStore'
import useCategoryStore from '../store/useCategoryStore'
import useSubcategoryStore from '../store/useSubcategoryStore'
import useAccountStore from '../store/useAccountStore'
import { exportTransactionsToExcel, exportFullBackup } from '../utils/exportData'

function ExportCard({ icon, title, text, button, onClick }) {
  const [busy, setBusy] = useState(false)
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{text}</p>
        </div>
      </div>
      <button disabled={busy}
        onClick={async () => { setBusy(true); try { await onClick() } finally { setBusy(false) } }}
        className="mt-3 w-full py-2.5 rounded-xl bg-indigo-600 active:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60">
        {busy ? 'Exportando…' : button}
      </button>
    </section>
  )
}

// Pantalla móvil (Más → Exportar datos)
export default function Exportar() {
  const transactions = useTransactionStore((s) => s.transactions)
  const categories = useCategoryStore((s) => s.categories)
  const subcategories = useSubcategoryStore((s) => s.subcategories)
  const accounts = useAccountStore((s) => s.accounts)

  async function excel() {
    const sorted = [...transactions].sort((a, b) => (b.fechaContable || '').localeCompare(a.fechaContable || ''))
    try {
      await exportTransactionsToExcel(sorted, { categories, subcategories, accounts })
    } catch (e) {
      alert(`No se pudo exportar:\n${e?.message ?? e}`)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Exportar datos</h1>
      <ExportCard icon="📊" title="Movimientos en Excel"
        text={`Los ${transactions.length} movimientos, con categoría, cuenta y notas.`}
        button="Exportar a Excel" onClick={excel} />
      <ExportCard icon="💾" title="Copia de seguridad"
        text="Todos tus datos en un archivo JSON, para guardarlos o pasarlos a otro dispositivo. Se restaura desde Importar."
        button="Exportar copia" onClick={exportFullBackup} />
    </div>
  )
}
