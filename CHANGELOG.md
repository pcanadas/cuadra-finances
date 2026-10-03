# Changelog

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
