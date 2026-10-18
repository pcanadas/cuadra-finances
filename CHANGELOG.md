# Changelog

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
- **Exportar gráficos a PNG** — botón "📷 PNG" en los gráficos de evolución mensual, distribución/comparación, comparativa anual y comparación mensual entre años; exporta a 2x resolución con fondo blanco

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
