import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import { useAndroidBackButton, useEscapeKey } from '../platform/back'

export default function Layout() {
  useAndroidBackButton()
  useEscapeKey()

  // Cada pantalla empieza arriba
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[calc(var(--sat)+3.75rem)] pb-[calc(5rem+var(--sab))] lg:py-8">
        <Outlet />
      </main>
    </div>
  )
}
