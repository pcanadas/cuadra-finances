# Cuadra — Finanzas del hogar

App de escritorio para gestión de finanzas personales, construida con React + Tauri. Importa extractos bancarios, categoriza movimientos automáticamente y visualiza la evolución de tus gastos e ingresos.

---

## Descarga

**Windows** — [Cuadra_0.5.0_x64-setup.exe](https://github.com/pcanadas/cuadra-finances/releases/latest)

No requiere instalación de dependencias. Incluye actualizaciones automáticas.

> **Actualización desde una versión anterior** — los datos no se pierden. Cuadra guarda movimientos, categorías y configuración en IndexedDB (WebView2), una carpeta del perfil de Windows que el instalador no modifica. Puedes instalar encima o desinstalar primero; el resultado es el mismo.

---

## Funcionalidades

- **Importación de extractos bancarios** — Bankinter (XLS nativo) y formato genérico CSV/Excel con mapeo de columnas configurable
- **Categorización automática** por palabras clave con soporte de excepciones (`palabrasExcluidas`)
- **Detección automática de subcategorías** en importación — asigna subcategorías por keywords al importar, con vista previa en la tabla de importación
- **Subcategorías** con auto-aprendizaje: al asignar manualmente una subcategoría, la keyword se añade automáticamente para futuras importaciones
- **Sugerencias de keywords para subcategorías** — panel que detecta asignaciones manuales sin keyword coincidente y sugiere añadirla
- **Múltiples cuentas** — pestañas por cuenta, badges de color
- **Movimientos manuales** editables y eliminables desde la tabla
- **Edición inline de categoría y subcategoría** en la tabla de movimientos
- **Creación rápida de subcategoría** desde la tabla de movimientos (opción "＋ Nueva..." en el selector inline)
- **Evolución de saldo para cuentas de efectivo** — modo sintético con saldo inicial configurable cuando no hay extracto importado
- **Selección múltiple** para categorizar y subcategorizar en lote (en Movimientos y en la vista previa de importación)
- **Filtros avanzados en Movimientos** — por mes, categoría, subcategoría, tipo (ingreso/gasto) y búsqueda de texto
- **Deshacer cambios** — botón para revertir los últimos cambios de categoría/subcategoría (hasta 30 acciones)
- **Dashboard anual** con gráficos de barras, tarta, tabla de gastos por categoría × mes y comparativa interanual
- **Comparación mensual entre años** — superpone barras del año seleccionado vs el anterior
- **Comparación de múltiples categorías** — selecciona hasta 6 categorías y compara su evolución mensual
- **Exportar gráficos a PNG** — botón en cada gráfico del Dashboard para descargar a 2x resolución
- **Evolución del saldo** por cuenta con verificador de coherencia (detecta huecos en el extracto) y opciones de editar o marcar como revisada
- **Escala √ en gráficos** — toggle para comprimir barras cuando un mes outlier aplasta el resto
- **Página Acerca de** — versión instalada y comprobador de actualizaciones
- **Tema oscuro/claro** con paleta personalizada y persistencia
- **Copia de seguridad** exportable/restaurable en JSON
- **Actualizaciones automáticas** firmadas con minisign vía tauri-plugin-updater

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 19 + Vite 8 |
| Routing | React Router DOM 7 (HashRouter para Tauri) |
| Estilos | Tailwind CSS 4 |
| Gráficos | Recharts 3 |
| Estado global | Zustand 5 |
| Base de datos local | Dexie 4 (IndexedDB) |
| Parseo CSV | PapaParse 5 |
| Parseo Excel | XLSX 0.18 |
| Fechas | date-fns 4 |
| App de escritorio | Tauri 2 (Rust) |
| Firma de actualizaciones | minisign (tauri-plugin-updater) |

---

## Capturas

### Modo oscuro

![Dashboard](/.github/screenshots/dashboard_dark.png)

![Movimientos](/.github/screenshots/movimientos.png)

![Evolución del saldo](/.github/screenshots/cuentas.png)

![Subcategorías](/.github/screenshots/subcategorias.png)

### Modo claro

![Dashboard claro](/.github/screenshots/dashboard_light.png)

---

## Arquitectura

### Base de datos

`CuadraFinances` vía Dexie/IndexedDB — versión 2. Cada transacción es un registro individual, no un blob JSON. Sin límite práctico de almacenamiento.

```
transactions   id, fechaContable[idx], categoria[idx], accountId[idx],
               descripcion, importe, saldo, categoriaManual, esManual, subcategoria,
               bankRowIndex

categories     id, nombre, palabrasClave[], palabrasExcluidas[],
               color, esIngreso?, esTransferencia?, _order?

subcategories  id, categoriaId[idx], nombre, palabrasClave[], color

accounts       id, nombre, tipo, color, saldoInicial?, acknowledgedGaps[]
```

La versión 2 añade `accounts` e índice `accountId`. La migración Dexie es automática y no destructiva.

### Saldo sintético (cuentas de efectivo)

Para cuentas sin extracto bancario importado, Cuentas calcula el saldo acumulado a partir de los movimientos manuales:

```
saldo[i] = saldoInicial + Σ importe[0..i]
```

`saldoInicial` se guarda en el objeto `account` y es editable desde la propia página. El verificador de coherencia se oculta en este modo (no hay saldo real con el que comparar).

### Estado (Zustand)

Cuatro stores independientes sin `persist` middleware — la persistencia la gestiona Dexie directamente:

| Store | Responsabilidad |
|---|---|
| `useTransactionStore` | CRUD de movimientos + `bulkUpdateTransactions` para re-categorización/subcategorización masiva |
| `useCategoryStore` | CRUD + reordenación drag & drop + migración automática de flags |
| `useSubcategoryStore` | CRUD de subcategorías |
| `useAccountStore` | CRUD de cuentas bancarias con seed de datos por defecto |

### Lógica de categorización

`src/utils/categorize.js`:

1. Normaliza descripción (mayúsculas + colapsa whitespace — Bankinter inserta dobles espacios en nombres Bizum)
2. Por cada categoría en orden: si hay match en `palabrasExcluidas` → salta; si hay match en `palabrasClave` → asigna
3. Fallback a "Otros"
4. Para cada movimiento categorizado, busca subcategoría entre las subcategorías de esa categoría por keyword match

`extractKeyword()` elimina prefijos bancarios comunes (`PAGO BIZUM A`, `TRANSF /`, `RECIBO /`...) y devuelve la parte significativa para auto-aprendizaje de keywords.

### Parser de importación

`src/utils/importParsers.js` — detección automática de formato:

- **Bankinter XLS**: detecta si A1 contiene `"MOVIMIENTOS"` o IBAN (`ES...`). Escanea buscando la fila de cabecera con `"Fecha contable"` para separar la sección de movimientos pendientes de la principal. Maneja importes numéricos nativos de Excel (evita el bug de quitar puntos de miles al parsear string `"1.234,56"`).
- **CSV/XLSX genérico**: PapaParse con auto-detección de headers + mapeo manual de columnas en el flujo de importación.
- Fechas: detecta `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD` y fechas numéricas Excel (serial desde 1900).

### Verificador de coherencia de saldo

Usa `chainGlobal()` para reconstruir el orden original del banco por enlace de saldos (`saldo[i-1] + importe[i] = saldo[i]`), sin depender del orden por fecha. Esto resuelve el problema de Bankinter, que intercala transacciones con distinta `fechaContable` dentro del mismo bloque de exportación.

Para cada par de transacciones consecutivas en la cadena comprueba:

```
|saldo[i-1] + importe[i] - saldo[i]| > 0.02 €  →  inconsistencia
```

La tolerancia de 2 céntimos absorbe redondeos bancarios. Cada inconsistencia ofrece dos acciones:
- **Editar** — corregir fecha, descripción u otros campos del movimiento
- **Revisada ✓** — marcar como hueco conocido (persiste en `account.acknowledgedGaps` vía Dexie)

`bankRowIndex` se guarda al importar cada transacción para desambiguar candidatos con el mismo importe/saldo.

### Tema oscuro

Estrategia CSS-first: un único toggle de clase `dark` en `<html>` + sobreescrituras `html.dark .clase-tailwind` en `index.css`. Los componentes no necesitan variants `dark:`. Solo Recharts requiere detección JS del tema (los colores van en props, no en CSS).

### Tauri

- `HashRouter` en lugar de `BrowserRouter` — no hay servidor web que resuelva rutas en la app empaquetada
- Plugins (`plugin-dialog`, `plugin-fs`, `plugin-updater`, `plugin-process`) importados dinámicamente con `new Function('pkg', 'return import(pkg)')` para escapar el análisis estático de Vite — la app funciona en el navegador durante desarrollo con fallback `try/catch`
- Las actualizaciones automáticas no borran datos: IndexedDB vive en el `AppData` del WebView, que Tauri preserva entre versiones

---

## Desarrollo

```bash
npm install
npm run tauri:dev    # app de escritorio con hot-reload (requiere Rust + cargo)
```

### Generar instalador

```powershell
# Configurar firma (necesario una vez por sesión)
# .TrimEnd() evita que el salto de línea final rompa la firma
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content src-tauri/signing/cuadra.key -Raw).TrimEnd()
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "tu-contraseña"

npm run tauri:build
```

Genera `src-tauri/target/release/bundle/nsis/Cuadra_x.x.x_x64-setup.exe` + `.sig`.

**Requisitos:** Rust + cargo, WebView2 (incluido en Windows 11).

---

## Licencia

MIT — ver [LICENSE](LICENSE)
