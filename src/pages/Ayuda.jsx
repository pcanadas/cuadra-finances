import { useState } from 'react'
import InfoPage from '../components/InfoPage'
import { SUPPORT_EMAIL } from '../platform/share'

const FAQ = [
  {
    q: '¿Cómo apunto un gasto o un ingreso?',
    a: 'Pulsa el botón + de la barra inferior. Elige Gasto, Ingreso o Transferencia, toca la categoría, escribe el importe y pulsa Guardar. Por defecto se apunta con fecha de hoy y en la última cuenta que usaste.',
  },
  {
    q: '¿Puedo importar los movimientos de mi banco?',
    a: 'Sí, desde Más → Importar extracto. Admite PDF, CSV y Excel. Descarga el extracto desde la app o la web de tu banco y elígelo. Cuadra reconoce las columnas, asigna categorías y descarta los movimientos repetidos.',
  },
  {
    q: 'Mi PDF da error al importarlo',
    a: 'Algunos bancos generan el PDF como imágenes, sin texto, y no se puede leer. En ese caso descarga los movimientos en CSV o Excel. Si tu banco da un PDF con texto y no funciona, escríbenos desde Más → Comentarios.',
  },
  {
    q: '¿Cómo cambio la categoría de varios movimientos a la vez?',
    a: 'En Movimientos, mantén pulsado uno para empezar a seleccionar y toca los demás. Abajo aparecerá una barra para elegir la nueva categoría.',
  },
  {
    q: '¿Dónde se guardan mis datos?',
    a: 'Solo en tu móvil. Cuadra no tiene servidores ni cuentas de usuario: nadie más puede ver tus movimientos.',
  },
  {
    q: '¿Qué pasa si desinstalo la app o cambio de móvil?',
    a: 'Al desinstalar se borran los datos. Antes, haz una copia en Más → Exportar datos → Copia de seguridad, guárdala donde quieras y restáurala después desde Importar extracto.',
  },
  {
    q: '¿Puedo cambiar los iconos o el tamaño de letra?',
    a: 'Sí, en Más → Ajustes: tema claro u oscuro, tamaño de letra e iconos de cada categoría.',
  },
]

function Question({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="border-b border-slate-100 last:border-b-0">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 py-3 text-left">
        <span className="flex-1 text-sm font-medium text-slate-800">{q}</span>
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && <p className="pb-3 text-sm text-slate-600 leading-relaxed">{a}</p>}
    </li>
  )
}

export default function Ayuda() {
  return (
    <InfoPage title="Ayuda">
      <ul className="bg-white rounded-xl border border-slate-200 shadow-sm px-4">
        {FAQ.map((f) => <Question key={f.q} {...f} />)}
      </ul>
      <p className="text-sm text-slate-500 px-1">
        ¿No encuentras lo que buscas? Escríbenos a <span className="font-medium text-indigo-600">{SUPPORT_EMAIL}</span> o desde Más → Comentarios.
      </p>
    </InfoPage>
  )
}
