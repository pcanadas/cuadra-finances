import { useState, useEffect } from 'react'

export function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('cuadra-theme')
    if (stored) return stored === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('cuadra-theme', dark ? 'dark' : 'light')
    // Android: iconos de la barra de estado y de navegación acordes al tema (MainActivity.kt)
    window.CuadraTheme?.set(dark)
  }, [dark])

  return [dark, setDark]
}
