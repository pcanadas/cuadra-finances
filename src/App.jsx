import { useEffect, useState } from 'react'
import { HashRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import UpdateChecker from './components/UpdateChecker'
import Dashboard from './pages/Dashboard'
import Movimientos from './pages/Movimientos'
import Importar from './pages/Importar'
import Categorias from './pages/Categorias'
import Subcategorias from './pages/Subcategorias'
import Cuentas from './pages/Cuentas'
import Acerca from './pages/Acerca'
import useTransactionStore from './store/useTransactionStore'
import useCategoryStore from './store/useCategoryStore'
import useSubcategoryStore from './store/useSubcategoryStore'
import useAccountStore from './store/useAccountStore'

export default function App() {
  const loadTransactions  = useTransactionStore((s) => s.loadFromDB)
  const loadCategories    = useCategoryStore((s) => s.loadFromDB)
  const loadSubcategories = useSubcategoryStore((s) => s.loadFromDB)
  const loadAccounts      = useAccountStore((s) => s.loadFromDB)

  const [ready, setReady] = useState(false)
  const [error, setError]  = useState(null)

  useEffect(() => {
    Promise.all([loadTransactions(), loadCategories(), loadSubcategories(), loadAccounts()])
      .then(() => setReady(true))
      .catch((err) => {
        console.error('Error loading data from database:', err)
        setError(err?.message ?? 'Error al cargar los datos')
      })
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="bg-white rounded-2xl border border-red-200 shadow p-8 max-w-md text-center">
          <p className="text-red-600 font-semibold text-lg mb-2">Error al cargar la base de datos</p>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm animate-pulse">Cargando datos…</div>
      </div>
    )
  }

  return (
    <ThemeProvider>
    <UpdateChecker />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="movimientos" element={<Movimientos />} />
          <Route path="importar" element={<Importar />} />
          <Route path="categorias" element={<Categorias />} />
          <Route path="subcategorias" element={<Subcategorias />} />
          <Route path="cuentas" element={<Cuentas />} />
          <Route path="acerca" element={<Acerca />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  )
}
