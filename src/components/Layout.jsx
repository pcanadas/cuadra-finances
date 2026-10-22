import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8">
        <Outlet />
      </main>
    </div>
  )
}
