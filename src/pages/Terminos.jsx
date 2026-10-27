import InfoPage, { InfoSection } from '../components/InfoPage'
import { SUPPORT_EMAIL, DEVELOPER } from '../platform/share'

// Mismo texto que se publicará en https://www.xyfos.com/cuadra/terminos
export default function Terminos() {
  return (
    <InfoPage title="Términos de uso" updated="22 de octubre de 2026">
      <InfoSection title="Titular">
        <p>Zenit es una aplicación gratuita y sin ánimo comercial desarrollada por {DEVELOPER}. Al usarla aceptas estos términos.</p>
      </InfoSection>
      <InfoSection title="Información orientativa">
        <p>Los totales, gráficos, previsiones y categorías se calculan a partir de los datos que introduces o importas. Son orientativos y <strong>no constituyen asesoramiento financiero, fiscal ni legal</strong>. Comprueba siempre las cifras importantes con tu banco.</p>
      </InfoSection>
      <InfoSection title="Tus datos">
        <p>Los datos se guardan en tu dispositivo y eres responsable de conservarlos. Te recomendamos hacer copias de seguridad periódicas desde Exportar datos. No podemos recuperar datos perdidos al desinstalar la app o al cambiar de dispositivo sin copia.</p>
      </InfoSection>
      <InfoSection title="Responsabilidad">
        <p>La app se ofrece gratuitamente y tal como está. Trabajamos para que funcione bien, pero no podemos garantizar que esté libre de errores ni que reconozca todos los formatos de extracto bancario.</p>
        <p>En la medida permitida por la ley, el titular no responde de los daños derivados de su uso. Esto no limita la responsabilidad que no pueda excluirse legalmente, como la derivada de dolo o culpa grave, ni los derechos que te correspondan como consumidor.</p>
      </InfoSection>
      <InfoSection title="Código abierto">
        <p>El código de Zenit es público bajo licencia GNU GPL v3 o posterior, que regula su reutilización. El nombre «Zenit» y su logotipo no están incluidos en esa licencia.</p>
      </InfoSection>
      <InfoSection title="Ley aplicable">
        <p>Estos términos se rigen por la legislación española. Si actúas como consumidor, podrás acudir a los tribunales de tu domicilio.</p>
      </InfoSection>
      <InfoSection title="Contacto">
        <p>Para cualquier duda: <span className="font-medium text-indigo-600">{SUPPORT_EMAIL}</span>.</p>
      </InfoSection>
    </InfoPage>
  )
}
