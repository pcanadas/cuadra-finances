export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.xyfos.cuadra'
export const SUPPORT_EMAIL = 'cuadra@xyfos.com'
export const DEVELOPER = 'Patricia Cañadas (Xyfos Code)'

/**
 * Abre el menú de compartir del sistema.
 * Android (app): puente nativo de MainActivity.kt · navegador: Web Share API ·
 * si no hay ninguno, copia el texto al portapapeles.
 * @returns {Promise<'shared' | 'copied' | 'cancelled'>}
 */
export async function shareText({ title, text }) {
  if (window.CuadraShare) {
    window.CuadraShare.text(title, text)
    return 'shared'
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch {
      return 'cancelled'
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}

export function recommendApp() {
  return shareText({
    title: 'Recomendar Cuadra',
    text: `Te recomiendo Cuadra, una app gratuita para llevar las finanzas de casa: gastos, ingresos y presupuestos, sin anuncios y con tus datos solo en tu móvil.\n${PLAY_STORE_URL}`,
  })
}

/** Abre la app de correo con el mensaje preparado (no se envía nada sin que el usuario lo confirme). */
export function composeEmail({ to = SUPPORT_EMAIL, subject, body }) {
  if (window.CuadraShare?.email && window.CuadraShare.email(to, subject, body)) return
  window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
