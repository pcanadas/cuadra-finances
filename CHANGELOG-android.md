# Changelog — Android

Versiones de la app móvil (independientes de las de escritorio, ver `CHANGELOG.md`).
La versión se define en `src-tauri/tauri.android.conf.json`.

Cada versión incluye las **notas para Google Play** («Novedades», máximo 500 caracteres) listas para copiar en la consola.

---

## [1.1.3] — planificada

- **Botones «+ Gasto» / «+ Ingreso» en la barra de notificaciones** (se activa en Ajustes) que abren el alta rápida con el tipo elegido
- **Accesos directos del icono** (mantener pulsado): «Nuevo gasto» y «Nuevo ingreso»

---

## [1.1.2] — 2026-10-23

Primera versión para la prueba cerrada.

### Añadido
- **Bienvenida** para quien abre la app por primera vez: «Apunta tu primer gasto» o «Importa un extracto del banco»
- **Recordatorio de copia de seguridad** en Inicio (la primera vez tras una semana de uso; después, si pasa un mes sin copia)
- **Nuevas categorías por defecto**: Alimentación, Ocio, Vivienda, Impuestos, Coche, Transportes, SS / Autónomos y Mascotas, entre otras
- **Cajero**: las retiradas se registran como traspaso a la cuenta Efectivo (no cuentan como gasto)

### Cambiado
- «Movimientos» pasa a llamarse **«Registros»** en el móvil
- Los datos de la app **ya no se copian a la nube de Google** (Android Auto Backup); solo están en el móvil, como dice la política de privacidad

### Corregido
- **Categorización automática**: las palabras clave con espacios ahora exigen la palabra completa (p. ej. un «BIZUM RECIBIDO» ya no cae en Impuestos por contener «IBI»)

### Notas para Google Play
```
<es-ES>
Primera versión de Cuadra para Android:
• Apunta gastos, ingresos y transferencias en segundos con el botón +
• Importa los extractos de tu banco en PDF, CSV o Excel
• Previsión del mes, presupuestos y cierre de meses anteriores
• Gráficos por categoría, mes y año
• Exporta tus datos a Excel o haz copia de seguridad
• Gratis, sin anuncios, sin cuentas y con tus datos solo en tu móvil
</es-ES>
```

---

## [1.1.1] — 2026-10-22

### Corregido
- **Barras del sistema según el tema de la app** — los iconos de la barra de estado y de navegación se ven en claro y en oscuro (antes salían blancos sobre fondo claro u oscuros sobre fondo oscuro), y la barra de 3 botones ya no muestra una franja blanca en modo oscuro
- **Icono recortado** — en los móviles con icono redondo o «squircle» se cortaban la línea naranja y la «c»; el dibujo del icono adaptativo tiene ahora margen de seguridad

### Mejorado
- **Gastos fijos en el móvil** — cada gasto en dos líneas (nombre e importe; categoría, periodicidad y lo pagado), tocar para editar y botón «Eliminar» en el formulario, que se desplaza a la vista al abrirlo
- **Menú «Más» con desplazamiento** — ya no queda tapado por la cabecera y se puede desplazar si no cabe (letra grande o más opciones)
- **Símbolos de depuración** incluidos en el paquete para los informes de fallos de Google Play

### Notas para Google Play
```
<es-ES>
• Los iconos de la barra de estado se ven bien en modo claro y oscuro
• Gastos fijos más cómodos en el móvil: toca un gasto para editarlo o eliminarlo
• Icono de la app sin recortes
</es-ES>
```

---

## [1.1.0] — 2026-10-22

Primera versión publicada en Google Play.

### Añadido
- **Importar extractos en PDF** — además de CSV y Excel. Probado con Bankinter; reconoce columnas Cargo/Abono, conceptos en varias líneas, PDF con contraseña, y avisa si el PDF es una imagen sin texto
- **CSV con cabecera desplazada** — se detecta la cabecera real aunque haya líneas de titular/IBAN antes (CaixaBank)
- **Vista previa de importación en tarjetas** — tocar para seleccionar y cambiar la categoría en lote antes de importar
- **Previsión por mes** — la previsión de Inicio sigue al selector de periodo: «Cierre del mes» para meses pasados (pagados/no pagados, sobrante) y previsión para el actual y futuros; los presupuestos muestran el gasto de ese mes
- **Exportar datos** (Más) — movimientos a Excel y copia de seguridad completa
- **Ayuda, Términos de uso y Política de privacidad** dentro de la app
- **Sobre nosotros** (antes «Acerca de») y **Licencias de terceros** (`npm run licenses`)
- **Comentarios** — ventana para enviar sugerencias por correo
- **Recomendar a amigos** — comparte el enlace de Google Play con el menú de compartir de Android
- **Selectores propios** en lugar de los desplegables del sistema

### Mejorado
- **Menú «Más» en dos bloques**: gestión (importar, exportar, gastos fijos, categorías, subcategorías, ajustes) e información (ayuda, términos, privacidad, sobre nosotros, comentarios, recomendar)
- **Inicio**: leyenda del gráfico circular bajo el gráfico (ya no se solapa con letra grande); sin «Escala lineal» en móvil; desglose por categoría sin negritas
- **Tamaño de letra** con control deslizante (por defecto, el del sistema)
- Los modales (cuentas, alta manual) ya no quedan detrás de la barra de navegación del sistema

### Notas para Google Play
```
Primera versión de Cuadra para Android:
• Apunta gastos, ingresos y transferencias en segundos con el botón +
• Importa los extractos de tu banco en PDF, CSV o Excel
• Previsión del mes, presupuestos y cierre de meses anteriores
• Gráficos por categoría, mes y año
• Exporta tus datos a Excel o haz copia de seguridad
• Gratis, sin anuncios, sin cuentas y con tus datos solo en tu móvil
```

---

## [1.0.0] — 2026-10-22 (no publicada)

Primera versión instalable (prueba interna por USB). Adaptación de la app de escritorio a Android.

### Añadido
- Proyecto Android con Tauri 2 (`targetSdk 37`, mínimo Android 7), firma de release y versión propia
- Barra inferior **Inicio · Movimientos · ➕ · Cuentas · Más** y cabecera compacta
- **Alta rápida** (➕): gasto/ingreso/transferencia, categorías con icono, importe, día (hoy por defecto), nota y cuenta; aviso con «Deshacer»
- **Movimientos en tarjetas** por día, hoja de detalle, selección múltiple con pulsación larga y filtros plegables
- **Selector de periodo** mes/año en Inicio con KPIs del periodo (gastos, ingresos, balance, gasto diario)
- **Ajustes**: tema claro/oscuro, tamaño de letra e iconos de categorías
- Gesto atrás de Android (cierra hojas y modales, navega atrás, sale desde Inicio)
- Márgenes correctos con barra de gestos y de 3 botones

### Cambiado
- Sin actualizador automático en Android (las actualizaciones llegan por Google Play)
