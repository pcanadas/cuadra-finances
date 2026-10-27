import InfoPage, { InfoSection } from '../components/InfoPage'
import { SUPPORT_EMAIL, DEVELOPER } from '../platform/share'

// Mismo texto que https://www.xyfos.com/cuadra/privacidad (repo xyfos-code: src/pages/cuadra/privacidad.astro)
export default function Privacidad() {
  const email = <span className="font-medium text-indigo-600">{SUPPORT_EMAIL}</span>

  return (
    <InfoPage title="Política de privacidad" updated="27 de octubre de 2026">
      <InfoSection>
        <p>Zenit es una aplicación gratuita para llevar las finanzas personales, diseñada para que tus datos sean solo tuyos.</p>
      </InfoSection>
      <InfoSection title="Responsable">
        <p>{DEVELOPER}. Contacto: {email}.</p>
      </InfoSection>
      <InfoSection title="Datos que guarda la app">
        <p>Los movimientos, cuentas, categorías, presupuestos y ajustes que introduces o importas. Se guardan <strong>únicamente en tu dispositivo</strong> y nunca se envían al responsable ni a terceros.</p>
      </InfoSection>
      <InfoSection title="Datos que recogemos">
        <p><strong>Solo los comentarios que decidas enviarnos</strong> (ver más abajo). Zenit no tiene cuentas de usuario, no incluye publicidad ni herramientas de analítica y nunca envía tus movimientos ni tus datos financieros.</p>
      </InfoSection>
      <InfoSection title="Archivos que importas o exportas">
        <p>Los extractos bancarios que importas se leen en tu dispositivo y no se envían a ningún sitio. Las copias de seguridad y exportaciones se guardan donde tú elijas; a partir de ahí, su custodia depende de ti.</p>
      </InfoSection>
      <InfoSection title="Comentarios y consultas">
        <p>Si nos envías un comentario desde la app (Más → Comentarios), recibimos el texto que escribes, tu email solo si decides indicarlo, y la versión de la app y del sistema (Android o escritorio) para entender el problema. Se envía cifrado a nuestro servidor (xyfos.com), que nos lo reenvía por correo y <strong>no lo guarda</strong>. Para evitar abusos, el servidor usa tu dirección IP durante una hora, de forma cifrada, para limitar el número de envíos. Si nos escribes directamente por correo, recibimos tu dirección y el contenido del mensaje.</p>
        <p><strong>Finalidad:</strong> leer tus sugerencias, responderte si nos has dejado tu email y mejorar la app. <strong>Base legal:</strong> tu consentimiento, que das al enviarnos el mensaje.</p>
        <p><strong>Conservación:</strong> el tiempo necesario para atender tu comentario y, como máximo, 12 meses desde el último contacto.</p>
        <p><strong>Destinatarios:</strong> no se ceden a terceros. Los mensajes pasan por el proveedor de alojamiento y de correo del responsable, que actúa como encargado del tratamiento.</p>
      </InfoSection>
      <InfoSection title="Tus derechos">
        <p>Puedes pedir el acceso, la rectificación o la supresión de tus datos, oponerte a su tratamiento, solicitar su limitación o portabilidad y retirar tu consentimiento en cualquier momento, escribiendo a {email}.</p>
        <p>Si consideras que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).</p>
      </InfoSection>
      <InfoSection title="Permisos">
        <p>La app solo accede a los archivos que eliges expresamente para importar o exportar, y a internet únicamente para enviar los comentarios y, en la versión de escritorio, para comprobar si hay actualizaciones (consulta un archivo público en GitHub, sin enviar ningún dato tuyo).</p>
      </InfoSection>
      <InfoSection title="Menores">
        <p>Zenit no está dirigida a menores de 14 años.</p>
      </InfoSection>
      <InfoSection title="Borrar tus datos">
        <p>Puedes borrarlos en cualquier momento desde Importar extracto → Borrar todos los datos, o desinstalando la app.</p>
      </InfoSection>
      <InfoSection title="Cambios">
        <p>Si esta política cambia, lo indicaremos en la app con una nueva fecha de actualización.</p>
      </InfoSection>
    </InfoPage>
  )
}
