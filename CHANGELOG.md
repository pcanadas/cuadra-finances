# Changelog

## [0.9.0] — sin publicar

### Cambiado
- **Base de datos preparada para sincronizar entre dispositivos (modelo v4)** — se actualiza sola la primera vez que se abre la app (unos segundos con años de movimientos), con una copia de seguridad automática antes («auto: antes de actualizar la base de datos»). No cambia nada de lo que ves. Cada registro guarda cuándo se modificó y desde qué dispositivo; los movimientos, si son manuales o importados y una huella (fecha, concepto e importe) para reconocer el mismo movimiento en otro dispositivo; los registros nuevos usan identificadores únicos (UUID v7). Al borrar un movimiento, categoría, cuenta, presupuesto o gasto fijo queda una marca de borrado sin su contenido, para que en el futuro el borrado llegue a los demás dispositivos. «Borrar todos los datos» y restaurar una copia lo siguen borrando todo por completo
- Las copias de seguridad de cualquier versión anterior se completan al restaurarlas

### Corregido
- **Restaurar una copia desde archivo fallaba si tenía gastos fijos** y no borraba los gastos fijos que había antes
- **Cuentas no mostraba lo anterior al primer extracto** — en una cuenta con extractos importados, los movimientos manuales y los traspasos desde otras cuentas con fecha anterior al primer extracto no salían en el gráfico ni en el saldo inicial. Ahora aparecen, con su saldo calculado hacia atrás desde el primer saldo del banco, y un aviso indica cuántos son

## [0.8.0] — 2026-10-27

### Cambiado
- **Sin alta rápida en escritorio** — fuera el botón «+ Nuevo» y la tecla N (en el ordenador se importan extractos; a mano, desde Movimientos → «+ Añadir manual»). Ajustes muestra solo el tamaño de letra: el tema está en la barra y los iconos de categorías solo los usa el móvil
- **Cuadra pasa a llamarse Zenit** — nuevo nombre en la app, la ventana, el menú Inicio y «Aplicaciones instaladas». Al actualizar se conservan todos los datos (siguen en `%LOCALAPPDATA%\com.xyfos.cuadra`). El instalador quita la instalación antigua de Cuadra (carpeta, entrada de «Aplicaciones instaladas» y acceso directo, que pasa a llamarse Zenit) sin usar su desinstalador, para no tocar los datos. Si tenías Cuadra anclada a la barra de tareas, hay que volver a anclar Zenit
- El ejecutable pasa de `Cuadra.exe` a `Zenit.exe` y las copias de seguridad se guardan como `zenit-backup-AAAA-MM-DD.json` (las antiguas `cuadra-backup-…` se siguen pudiendo restaurar)

### Corregido
- **Inconsistencias falsas en Cuentas** — la comprobación ya no reconstruye una cadena de saldos de años (se rompía y marcaba decenas de saltos que no lo eran): ahora un movimiento cuadra si otro cercano (31 días o sus 50 vecinos por fecha) deja justo el saldo que espera. Con extractos completos da 0 avisos; si falta un tramo, avisa en el movimiento siguiente
- **Duplicados al importar extractos que se solapan** — el día de la descarga el banco da saldos provisionales y el mismo movimiento volvía a entrar con otro saldo, contando doble en los totales. Ahora se comparan fecha, concepto e importe contando las copias (dos movimientos iguales del mismo extracto siguen siendo dos) y se queda el saldo definitivo. Cuentas muestra los duplicados ya importados para borrarlos (con copia de seguridad automática antes)
- **Movimientos pendientes de Bankinter** — se guardaban con saldo 0; ahora quedan como pendientes y se completan con su saldo al importar el siguiente extracto, sin duplicarse
- El texto de la cuenta destino decía que los movimientos se reflejan «como ingresos»; no cuentan como ingreso
- Resaltado de filas en la verificación de Cuentas: no se veía en modo claro y en oscuro era blanco y ocultaba el texto

### Añadido
- **Cuenta destino en categorías de traspaso, también hacia atrás** — al poner (o cambiar) la cuenta destino de una categoría o subcategoría de transferencia interna, todos sus movimientos aparecen en la cuenta destino: p. ej. Cajero → Efectivo crea una entrada en Efectivo por cada retirada (o se empareja con el movimiento real si el destino es otro banco). Al quitarla, esas entradas desaparecen. No cuentan como ingreso ni gasto; se respetan las transferencias apuntadas a mano
- **Versión para Microsoft Store** — `npm run store:build` genera el paquete MSIX (ver `DISTRIBUCION.md`); en esa versión las actualizaciones llegan por la Store

---

## [0.7.0] — 2026-10-27

Trae a escritorio las mejoras de la versión Android (1.1.0 – 1.1.3).

### Añadido
- **Importar extractos en PDF** — además de CSV y Excel. Probado con Bankinter: columnas Cargo/Abono, conceptos en varias líneas, PDF con contraseña y aviso si el PDF es una imagen sin texto. En los extractos con **varias cuentas** se elige a qué cuenta va cada una o se deja sin importar
- **Extractos con cabeceras en inglés** — se reconocen columnas como *Date / Booking date / Transaction date*, *Value date*, *Description / Details / Payee*, *Amount* y *Balance* (Revolut, N26, Wise, bancos británicos…); cargo y abono en columnas separadas (*Debit / Credit*, *Paid out / Paid in*, también *Cargo / Abono*); importes `1,234.56` y `(12.50)`; fechas `27 Oct 2026`, `Oct 27, 2026`, `2026-10-27 14:30` y formato de EE. UU. `10/27/2026` (se detecta por columna)
- **Dashboard por meses** — selector de periodo `‹ Octubre 2026 ▾ ›` para ver un mes o el año completo; se abre en el mes actual. Con un mes elegido, la tarjeta «Mes con más gasto» pasa a «Gasto diario» y la previsión muestra ese mes: «Cierre del mes» (pagados / no pagados, sobrante) para meses pasados y previsión para el actual y los futuros
- **Alta rápida** — botón **«+ Nuevo»** en la barra superior o tecla **N**: gasto, ingreso o transferencia con categoría por icono, importe (Intro para guardar), día y cuenta. Aviso «Gasto guardado» con **Deshacer**
- **Menú «Más»** en la barra superior: Exportar datos, Ajustes, Ayuda, Términos de uso, Política de privacidad, Sobre nosotros y Comentarios
- **Ajustes** — tema, tamaño de letra e iconos de categorías
- **Exportar datos** — movimientos a Excel y copia de seguridad completa en una sola pantalla
- **Comentarios** — envía sugerencias desde la app (o por correo si no hay conexión)
- **Ayuda, Términos de uso y Política de privacidad** dentro de la app
- **Recordatorio de copia de seguridad** en el Dashboard (la primera vez tras una semana de uso; después, si pasa un mes sin copia)
- **Bienvenida** cuando aún no hay datos: «Apunta tu primer gasto» o «Importa un extracto del banco»
- **Tecla Esc** para cerrar ventanas y menús
- **Cajero** — subcategoría de Transferencias internas que registra las retiradas como traspaso a la cuenta Efectivo (no cuentan como gasto). Se añade una vez si existen la categoría y la cuenta; afecta a lo que se importe a partir de ahora

### Mejorado
- **CSV y Excel con líneas antes de la cabecera** (titular, IBAN…) — se busca la cabecera real (CaixaBank); columnas vacías o repetidas ya no se pisan
- **Traspasos entre cuentas propias** — al importar, la salida de una cuenta y la entrada del mismo importe en otra (±3 días) se emparejan como traspaso y nunca cuentan como ingreso ni gasto (Dashboard, previsión y Gastos fijos)
- **Categorización automática** — las palabras clave con espacios exigen la palabra completa (un «BIZUM RECIBIDO» ya no cae en Impuestos por contener «IBI»)
- **Nuevas categorías por defecto** en instalaciones nuevas: Alimentación, Ocio, Vivienda, Impuestos, Coche, Transportes, SS / Autónomos, Mascotas…
- Barra superior más compacta en ventanas estrechas; «Acerca de» pasa a «Más → Sobre nosotros»

### Corregido
- **Excel en inglés confundido con Bankinter** — un Excel cuya primera columna contenía «ES» (p. ej. «Description» o «Notes») se leía como Bankinter y daba «El archivo está vacío»
- **Modo oscuro** — la tarjeta de vista previa de la importación salía blanca con el texto ilegible, y algunos textos se oscurecían al pasar el ratón

### Cambiado
- Licencia del código: GNU GPL v3 o posterior (antes MIT)
- Política de privacidad actualizada: comentarios desde escritorio y comprobación de actualizaciones

---
## [0.6.1] — 2026-10-22

### Corregido
- **Error "No se ha podido cerrar Cuadra" al actualizar** — el ejecutable pasa de llamarse `app.exe` (nombre genérico heredado del paquete Cargo) a `Cuadra.exe` mediante `mainBinaryName`; un hook del instalador NSIS (`src-tauri/windows/hooks.nsh`) elimina el `app.exe` antiguo al instalar y al desinstalar

### Eliminado
- **Instalador MSI** — solo se genera el instalador NSIS (por usuario, el que usa el actualizador); el MSI instalaba para todo el equipo en `Program Files` y podía acabar conviviendo con la instalación por usuario

---

## [0.6.0] — 2026-10-19

### Añadido
- **Cuenta destino en transferencias internas** — las categorías y subcategorías marcadas como transferencia interna pueden asociar una cuenta destino; se muestra como badge "→ Cuenta" en la vista de Categorías y Subcategorías, permitiendo modelar el flujo entre cuentas
- **Contrapartidas automáticas en transferencias** — al categorizar un movimiento como transferencia interna con cuenta destino, se crea automáticamente el ingreso en la cuenta destino (inmediato para efectivo) o se casa con un movimiento importado existente (por fecha ±3 días e importe); estos ingresos de traspaso no se contabilizan como ingreso real; funciona desde Movimientos (inline y masivo), Importar y Re-categorizar todo en Categorías
- **Versión dinámica en Acerca de** — `APP_VERSION` se lee de `package.json` en tiempo de build en lugar de estar hardcodeado
- **Pruebas automatizadas** — Vitest con 39 tests unitarios para las utilidades core: categorización (`categorize.js`), emparejamiento de transferencias (`transferPairing.js`) y parseo de importaciones (`importParsers.js`); scripts `npm test` y `npm run test:watch`
- **Historial de backups** — se guardan automáticamente hasta 10 copias de seguridad en IndexedDB antes de operaciones destructivas (borrar datos, restaurar backup); panel "Historial de backups" en Importar con opciones de restaurar, descargar y eliminar cada copia; también se guarda copia al exportar manualmente
- **Presupuestos mensuales** — sección en el Dashboard para definir límites de gasto por categoría; barras de progreso con código de color (verde/ámbar/rojo) que muestran el gasto del mes actual vs el límite; botones para añadir, editar y quitar presupuestos; datos incluidos en backup/restore
- **Exportar a Excel** — botón "Exportar Excel" en Movimientos que genera un fichero XLSX con los movimientos filtrados (fecha, descripción, importe, categoría, subcategoría, cuenta)
- **Pestaña Gastos fijos** — nueva página dedicada `/gastos-fijos` para gestionar gastos recurrentes y presupuestos; ingresos y gastos fijos separados (la nómina se detecta por categoría `esIngreso`); tarjetas resumen (ingresos fijos/mes, gastos fijos/mes, disponible, proyección anual); formulario inline con nombre, importe, categoría, subcategoría, periodicidad (mensual→anual), fecha de fin y mes de referencia para periodicidades no mensuales; seguimiento del mes actual (pagado ✓ / pendiente ○) solo para items que tocan ese mes; presupuestos por categoría con barras de progreso y detalle de gasto fijo asociado; sugerencias auto-detectadas de gastos e ingresos descartables (patrón dismiss con localStorage); matching inteligente por subcategoría → categoría → palabras del nombre + tolerancia de importe ±30%; link en la barra de navegación
- **Widget de previsión en Dashboard** — reemplaza las secciones completas de presupuestos y gastos fijos por un widget compacto con: ingresos fijos previstos, gastos fijos del mes, gastos variables (total − fijos pagados), pagados vs pendientes, disponible estimado, y top 4 presupuestos con barras de progreso; solo contabiliza items cuya periodicidad toca en el mes actual; enlace "Ver todo →" a la pestaña Gastos fijos

### Eliminado
- **Exportar gráficos a PNG** — eliminada la funcionalidad por baja calidad de los resultados

### Mejorado
- **Colores de KPIs** — las tarjetas de resumen en Dashboard y Gastos fijos usan fondos `color-500/10` (transparencia) en lugar de los tonos `-50`, más limpios y adaptados automáticamente al modo oscuro

### Corregido
- **Pantalla en blanco en Subcategorías** — el `useMemo` de sugerencias de keywords referenciaba variables (`catSubcats`, `catTransactions`) antes de su declaración, causando un crash al entrar en la página

---

## [0.5.0] — 2026-10-18

### Añadido
- **Detección automática de subcategorías en importación** — `autoCategorize` ahora asigna subcategorías por palabras clave además de categorías, filtrando solo las subcategorías pertenecientes a la categoría detectada
- **Columna Subcategoría en vista previa de importación** — la tabla del paso de preview muestra la subcategoría auto-asignada con badge de color
- **Edición masiva en vista previa de importación** — seleccionar movimientos con checkboxes y cambiar categoría/subcategoría en lote antes de importar
- **Subcategoría en edición masiva de Movimientos** — la barra de acciones masivas ahora permite asignar subcategoría además de categoría
- **Subcategoría inline en tabla de Movimientos** — cada fila muestra un selector de subcategoría filtrado por la categoría del movimiento
- **Filtro por subcategoría** en la página de Movimientos, con opción "Sin subcategoría"
- **Filtro por tipo (Ingreso/Gasto)** en la página de Movimientos
- **Botón Deshacer** — permite revertir los últimos cambios de categoría/subcategoría (hasta 30 acciones), visible en la barra superior de Movimientos
- **Sugerencias de palabras clave para subcategorías** — panel en Subcategorías que detecta movimientos asignados manualmente sin keyword coincidente y sugiere añadirla (con opción de descartar, persistido en localStorage)
- **Creación rápida de subcategoría desde Movimientos** — opción "＋ Nueva..." en el selector inline de subcategoría, crea la subcategoría con palabra clave auto-extraída y la asigna al movimiento
- **Comparación mensual entre años** — botón "Comparar" en el gráfico de evolución mensual que superpone barras del año seleccionado vs el anterior
- **Comparación de múltiples categorías** — botón "Comparar categorías" en el gráfico de distribución, permite seleccionar hasta 6 categorías y ver sus líneas de gasto mensuales superpuestas con chips de selección

---

## [0.4.0] — 2026-10-03

### Añadido
- **Página Acerca de** — muestra versión instalada, comprobador de actualizaciones con diagnóstico de errores
- **Verificador de coherencia mejorado** — algoritmo `chainGlobal` que reconstruye el orden original del banco por enlace de saldos (resuelve el problema de Bankinter que intercala fechaContable)
- **Editar desde inconsistencia** — botón "Editar" en cada fila del verificador para corregir el movimiento directamente
- **Marcar como revisada** — botón "Revisada ✓" para reconocer huecos conocidos entre extractos; persiste en la cuenta (Dexie)
- **Índice de fila bancaria** (`bankRowIndex`) — se guarda al importar para desambiguar movimientos con el mismo importe en el mismo día
- **Escala √ en Evolución Mensual** — botón toggle para usar escala raíz cuadrada cuando un mes con muchos ingresos aplasta las barras del resto
- **Detección de duplicados mejorada** — el fingerprint de importación incluye el saldo para evitar falsos positivos

### Corregido
- **Exportar backup en Tauri** — usa diálogo de guardar archivo en lugar de fallar silenciosamente
- **Gráfica de saldo** empezaba en el valor incorrecto (19,28€ en vez de 11.191,13€): ahora usa el saldo de apertura del primer día de cada mes
- **Etiquetas del eje Y** — valores < 10.000 se muestran completos (no redondeados a "1k 1k 1k")
- **Movimientos sin cuenta** — las transacciones importadas antes de multi-cuenta ahora se asignan correctamente a la primera cuenta
- **Cadenas desordenadas** — las cadenas de saldo se ordenan cronológicamente para evitar falsos saltos de fecha hacia atrás
- **Endpoint de actualizaciones** corregido en tauri.conf.json

### Eliminado
- Botón "Todos los movimientos" del gráfico de Cuentas (solo vista mensual)

---

## [0.3.0] — 2026-10-03

### Añadido
- **Editar movimientos manuales** — botón de lápiz inline en la tabla de Movimientos; abre el modal de edición con los datos precargados
- **Eliminar movimientos manuales** — botón de borrado inline con confirmación
- **Evolución de saldo en cuentas de efectivo** — modo sintético para cuentas sin extractos importados: calcula el saldo acumulado a partir de los movimientos manuales y un saldo inicial configurable

### Corregido
- **Exportar backup** no funcionaba en la app de escritorio Tauri; ahora guarda el archivo directamente en la carpeta Descargas sin requerir diálogo del sistema

---

## [0.2.0] — 2026-10-03

### Añadido
- **Múltiples cuentas bancarias** — pestañas por cuenta con badges de color
- **Página Cuentas** — gráfico de línea con la evolución del saldo y verificador de coherencia (detecta huecos en el extracto)
- **Ordenación de tablas** — columnas Fecha, Descripción e Importe ordenables en Movimientos y Subcategorías
- **Filtro por cuenta** en la barra de filtros de Movimientos
- **Movimientos manuales** — alta de apuntes sin importar extracto
- **Backup / Restore** — exportar e importar todos los datos en JSON
- **App de escritorio** — instalador NSIS con opción de instalación por usuario o global, actualizaciones automáticas firmadas con minisign

---

## [0.1.0] — 2026-09-01

### Añadido
- Importación de extractos Bankinter (XLS nativo) y CSV/Excel genérico con mapeo de columnas
- Categorización automática por palabras clave con soporte de excepciones
- Subcategorías con auto-aprendizaje de keywords al asignar manualmente
- Dashboard anual con gráficos de barras, tarta y tabla categoría × mes
- Tema oscuro/claro con persistencia
