import { useState } from 'react'
import InfoPage from '../components/InfoPage'
import { SUPPORT_EMAIL } from '../platform/share'
import { isMobile, deviceName } from '../platform'

// Dónde está cada cosa en móvil y en escritorio
const IMPORT = isMobile ? 'Más → Importar extracto' : 'Importar'

const FAQ = [
  {
    q: '¿Cómo apunto un gasto o un ingreso?',
    a: isMobile
      ? 'Pulsa el botón + de la barra inferior. Elige Gasto, Ingreso o Transferencia, toca la categoría, escribe el importe y pulsa Guardar. Por defecto se apunta con fecha de hoy y en la última cuenta que usaste.'
      : 'En Movimientos, pulsa «+ Añadir manual». Lo normal en el ordenador es importar los extractos del banco; los movimientos a mano son para lo que no pasa por el banco, como el efectivo.',
  },
  {
    q: '¿Puedo importar los movimientos de mi banco?',
    a: `Sí, desde ${IMPORT}. Admite PDF, CSV y Excel, también con las columnas en inglés. Descarga el extracto desde la app o la web de tu banco y elígelo. Zenit reconoce las columnas, asigna categorías y descarta los movimientos repetidos.`,
  },
  {
    q: 'Mi PDF da error al importarlo',
    a: 'Algunos bancos generan el PDF como imágenes, sin texto, y no se puede leer. En ese caso descarga los movimientos en CSV o Excel. Si tu banco da un PDF con texto y no funciona, escríbenos desde Más → Comentarios.',
  },
  {
    q: '¿Cómo cambio la categoría de varios movimientos a la vez?',
    a: isMobile
      ? 'En Registros, mantén pulsado uno para empezar a seleccionar y toca los demás. Abajo aparecerá una barra para elegir la nueva categoría.'
      : 'En Movimientos, marca sus casillas. Aparecerá una barra para elegir la nueva categoría y subcategoría.',
  },
  {
    q: '¿Cómo reflejo el dinero que saco del cajero?',
    a: 'En Categorías, marca la categoría (p. ej. Cajero) como transferencia interna y elige Efectivo como cuenta destino. Cada retirada aparecerá también como entrada en Efectivo, sin contar como ingreso ni como gasto. Sirve igual para traspasos a otra cuenta tuya.',
  },
  {
    q: '¿Qué diferencia hay entre presupuestos, ahorro y metas?',
    a: `Un presupuesto es un límite de gasto al mes para una categoría (en Gastos fijos) y te avisa al superarlo. El ahorro es una cantidad que quieres guardar cada mes, sin más; una meta, una cantidad para una fecha (un viaje, un coche…). Los dos se crean en ${isMobile ? 'Más → ' : ''}Ahorro y metas: puedes traspasar el dinero a una cuenta tuya o dejarlo apartado en la tuya, y cada mes se marca como conseguido, parcial o no conseguido. Lo que falta por apartar se descuenta del «Disponible para gastar».`,
  },
  {
    q: '¿Dónde se guardan mis datos?',
    a: `Solo en tu ${deviceName}. Zenit no tiene servidores ni cuentas de usuario: nadie más puede ver tus movimientos.`,
  },
  ...(isMobile ? [{
    q: '¿Puedo proteger Zenit con la huella o un PIN?',
    a: 'Sí: en Más → Ajustes, activa «Bloquear Zenit». Te pedirá la huella, la cara o el PIN, patrón o contraseña del móvil al abrir la app y al volver a ella (tú eliges tras cuánto tiempo). Lo comprueba Android: Zenit no guarda ninguna contraseña ni huella.',
  }] : []),
  {
    q: `¿Qué pasa si desinstalo la app o cambio de ${deviceName}?`,
    a: `Al desinstalar se borran los datos. Antes, haz una copia en Más → Exportar datos → Copia de seguridad, guárdala donde quieras y restáurala después desde ${IMPORT}. También sirve para pasar tus datos del ordenador al móvil o al revés.`,
  },
  {
    q: isMobile ? '¿Puedo cambiar los iconos o el tamaño de letra?' : '¿Puedo cambiar el tema o el tamaño de letra?',
    a: isMobile
      ? 'Sí, en Más → Ajustes: tema claro u oscuro, tamaño de letra e iconos de cada categoría.'
      : 'El tamaño de letra, en Más → Ajustes. El tema claro u oscuro, con el botón ☀️ / 🌙 de la barra superior.',
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
