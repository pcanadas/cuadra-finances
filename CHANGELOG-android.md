# Changelog — Android

Versiones de la app móvil (independientes de las de escritorio, ver `CHANGELOG.md`).
La versión se define en `src-tauri/tauri.android.conf.json`.

Cada versión incluye las **notas para Google Play** («Novedades», máximo 500 caracteres) listas para copiar en la consola.

---

## [1.4.0] — 2026-11-14

versionCode 1004000. Recoge lo de escritorio 0.11.0.

### Añadido
- **Resumen de Inicio en una tarjeta** — ingresos, gastos, balance y gasto diario (o el mes con más gasto en la vista anual) uno debajo de otro, en vez de cuatro KPI en cuadrícula
- **Tasa de ahorro** — bajo el balance, el porcentaje de los ingresos que no has gastado
- **«Al ritmo actual…»** — al final del resumen: cuánto ahorrarás (o el déficit) al terminar el mes o el año si sigues gastando al mismo ritmo (`src/insights/projection.js`)
- **Ordenar las tarjetas de Inicio** — «↕ Ordenar tarjetas» al final de Inicio; se guarda en el móvil

### Cambiado
- **Previsión del mes en una sola tarjeta** — incluye «Disponible para gastar» (con un tamaño de cifra como el resto) y, en filas, ingresos fijos, gastos fijos y gastos variables, sin recuadros separados
- **Evolución mensual** — barras más anchas (menos hueco entre meses) y con más color: en el móvil apenas se veían
- **Más contraste en el modo claro** — textos secundarios más oscuros y fondos pastel más intensos
- **Comparativa anual** — la tabla con el mismo tamaño de letra que las demás
- **Gastos fijos** — presupuestos con los importes debajo del nombre, tarjetas de resumen que no se salen con letra grande y «Ver más» en Sugerencias detectadas

### Corregido
- **Subcategorías no mostraba las partidas de los movimientos desglosados**

### Notas para Google Play («Novedades»)
```
• Inicio más claro: ingresos, gastos, balance y gasto diario en una tarjeta.
• Nuevo: tasa de ahorro y cuánto ahorrarás este mes a tu ritmo de gasto.
• Previsión del mes en una sola tarjeta, con lo que te queda para gastar.
• Ordena las tarjetas de Inicio como prefieras.
• Más contraste en el modo claro y barras de evolución más visibles.
• Gastos fijos: presupuestos más legibles y «Ver más» en sugerencias.
• Corregido: las partidas desglosadas aparecen en Subcategorías.
```

---

## [1.3.0] — 2026-11-13

versionCode 1003000. Recoge lo de escritorio 0.10.0–0.10.4 que aplica al móvil.

### Añadido
- **Aviso de nueva versión** — al abrir Zenit, si Google Play tiene una versión nueva aparece un aviso sobre la barra inferior; «Actualizar» abre la pantalla de actualización de Play (descarga, instala y vuelve a abrir Zenit). En Más → Acerca, «Comprobar actualizaciones». Usa las actualizaciones integradas de Google Play (`app-update`, `MainActivity.kt` → `window.CuadraUpdate`); solo responde si la app se instaló desde Play (en un APK de pruebas no avisa)
- **Desglosar un movimiento en partidas** — en Registros, toca el movimiento → «Desglosar en varias categorías»: reparte el importe (Amazon, PayPal, la tarjeta…) en partidas con su categoría, subcategoría y nota. En la lista se ve «Desglosado: …» con sus categorías; Inicio, presupuestos, gastos fijos y metas cuentan cada partida en su categoría
- **Notas en los movimientos** — campo «Nota» al tocar un movimiento (p. ej. «Pago muebles»); se ve en cursiva bajo la descripción y el buscador la encuentra
- **Separar impuestos** (Más → Ajustes, opcional) — la renta o el IBI no inflan los gastos, el balance ni el gasto diario de Inicio; se muestran aparte (y una devolución, en verde)
- **Previsión del mes** — cuánto has cobrado de los ingresos fijos y si es más o menos de lo previsto

### Cambiado
- **Gastos fijos: estado del mes más claro** — resumen de lo cobrado y lo pagado, y cada fijo con su estado (pendiente, en parte, pagado), barra de progreso y lo que falta; pensado para letra grande
- **Orden del mismo día** — los movimientos de un día se muestran en el orden del banco, siguiendo la cadena de saldos (`src/utils/txOrder.js`), para que el saldo de cada uno siga al anterior

### Corregido
- **Ingresos devueltos** (p. ej. una nómina) — ahora restan de los ingresos, de su subcategoría y de lo cobrado del ingreso fijo, sin esperarlos de vuelta
- **Pendientes del banco duplicados** — al importar, un movimiento ya contabilizado completa su pendiente aunque el texto o la fecha cambien (mismo importe, comercio y hasta 10 días después), y un pendiente que el banco sigue listando no se vuelve a añadir. Los duplicados que ya existían, también los antiguos con saldo 0, salen en «Movimientos duplicados» de la cuenta para revisarlos y borrarlos

### Notas para Google Play («Novedades»)
```
• Zenit te avisa cuando hay una versión nueva.
• Desglosa un cargo (Amazon, PayPal, la tarjeta…) en varias categorías.
• Añade notas a tus movimientos, como «Pago muebles».
• Opción para separar los impuestos de tus gastos del mes.
• La previsión del mes muestra cuánto has cobrado.
• Gastos fijos: el estado del mes, más claro.
• Los movimientos de un día siguen el orden del banco.
• Corregido: los pendientes del banco ya no se duplican.
• Corregido: un ingreso devuelto resta de los ingresos.
```

---

## [1.2.0] — 2026-10-29

versionCode 1002000.

### Cambiado
- **Cuadra pasa a llamarse Zenit** — nombre de la app en el móvil, textos y legales. El paquete sigue siendo `com.xyfos.cuadra`, así que se actualiza encima sin perder datos. Cambiar también el título de la ficha en Google Play
- Copias de seguridad como `zenit-backup-AAAA-MM-DD.json`
- **Base de datos preparada para sincronizar (modelo v4)** — se actualiza sola al abrir la app por primera vez, con copia de seguridad automática antes; no cambia nada visible (ver `CHANGELOG.md` 0.9.0)

### Añadido
- **Bloquear Zenit con la huella, la cara o el PIN del móvil** (Ajustes → «Bloquear Zenit», desactivado por defecto) — usa el diálogo de Android (plugin `biometric`); Zenit no guarda ninguna contraseña ni dato biométrico. Se pide al abrir la app; opcionalmente, también al volver a ella tras 1, 5 o 15 minutos fuera (por defecto, solo al abrir). Nunca al salir. Activarlo y desactivarlo también piden identificarse. La pantalla de bloqueo tapa la app sin cerrarla (no se pierde lo que estuviera a medias). Si el móvil se queda sin bloqueo de pantalla, el de Zenit se desactiva para no dejarte fuera de tus datos
- **Ahorro y metas** (Más → Ahorro y metas) — ahorra una cantidad al mes o reúne una cantidad para una fecha; traspasándolo a una cuenta o apartándolo sin moverlo. Cada mes: conseguido, parcial o no conseguido. Lo pendiente se descuenta del «Disponible para gastar»
- **Aviso de presupuesto superado** en Inicio
- **Disponible para gastar** en Inicio — cuánto te queda hasta fin de mes y cuánto al día (ingresos previstos − gastado − gastos fijos pendientes)
- **Cuenta destino en categorías de traspaso, también hacia atrás** — p. ej. Cajero → Efectivo: cada retirada aparece como entrada en Efectivo (sin contar como ingreso)
- **Extractos con cabeceras en inglés** (CSV y Excel): Date, Description, Amount, Debit / Credit, fechas de EE. UU. y con el mes en letras…

### Corregido
- **Duplicados al importar extractos que se solapan** (contaban doble) y **pendientes de Bankinter** guardados con saldo 0: ahora se completan al importar el siguiente extracto
- **Inconsistencias falsas** en la comprobación de saldos de Cuentas
- **Modo oscuro** — algunos textos se oscurecían al tocarlos
- **Cuentas** — los movimientos anteriores al primer extracto (manuales o traspasos) no salían en la evolución del saldo
- Restaurar una copia desde archivo fallaba si tenía gastos fijos
- **Gastos fijos** — lo cobrado o pagado en varios movimientos (p. ej. ingresos en dos partes, la compra del súper) ahora se suma y se ve el progreso
- Política de privacidad actualizada (comentarios y actualizaciones en la versión de escritorio)

### Notas para Google Play
```
<es-ES>
• Cuadra ahora se llama Zenit: misma app y tus datos de siempre
• Nuevo: bloquea Zenit con tu huella o el PIN del móvil (Ajustes)
• Nuevo: Ahorro y metas, con seguimiento mes a mes
• «Disponible para gastar» hasta fin de mes en Inicio
• Aviso al superar un presupuesto
• Gastos fijos muestra lo pagado o cobrado en varias veces
• Extractos con columnas en inglés y sin duplicados
</es-ES>
```

---

## [1.1.3] — 2026-10-24

### Añadido
- **Botones «+ Gasto» / «+ Ingreso» en la barra de notificaciones** (Ajustes → «Botones en la barra de notificaciones», desactivado por defecto): abren el alta rápida con el tipo elegido. Pide el permiso de notificaciones al activarlo (Android 13+), se repone al abrir la app si se ha quitado deslizando y tras reiniciar el móvil o actualizar la app
- **Accesos directos del icono** (mantener pulsado): «Nuevo gasto» y «Nuevo ingreso»

### Corregido
- **Extractos PDF con varias cuentas** (Bankinter «Extracto integral»): los movimientos de cada cuenta ya no se mezclan; antes de importar se elige en qué cuenta va cada una, o se deja sin importar (p. ej. un traspaso a la cuenta de ahorro ya no aparecía como ingreso en la principal)
- **Traspasos entre cuentas propias**: al importar, la salida de una cuenta y la entrada del mismo importe en otra (±3 días) se emparejan como traspaso, y un movimiento emparejado nunca cuenta como ingreso ni gasto (Inicio, previsión y Gastos fijos), aunque se le cambie la categoría

### Cambiado
- **Icono** sin la raya naranja superior
- Licencia del código: GNU GPL v3 o posterior (antes MIT)

### Notas para Google Play
```
<es-ES>
• Nuevo: botones «+ Gasto» y «+ Ingreso» en la barra de notificaciones (actívalos en Ajustes)
• Mantén pulsado el icono de la app para apuntar un gasto o un ingreso al momento
• Extractos PDF con varias cuentas: elige a qué cuenta va cada una o no la importes
• Los traspasos entre tus cuentas ya no cuentan como ingreso ni como gasto
• Icono renovado
</es-ES>
```

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
