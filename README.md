# Cuadra Finances

Aplicación web de gestión de finanzas del hogar. Importa extractos bancarios (Bankinter y formato genérico CSV/Excel), categoriza movimientos automáticamente por palabras clave y muestra dashboards con desglose mensual por categoría y subcategoría.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| UI | React 19 + Vite 8 |
| Routing | React Router DOM 7 |
| Estilos | Tailwind CSS 4 |
| Gráficos | Recharts 3 |
| Estado | Zustand 5 |
| Base de datos | Dexie 4 (IndexedDB) |
| Parseo CSV | PapaParse 5 |
| Parseo Excel | XLSX 0.18 |
| Fechas | date-fns 4 |
| Linting | Oxlint |

---

## Arrancar en desarrollo

```bash
npm install
npm run dev
```

---

## Estructura del proyecto

```
src/
├── App.jsx                  # Entrada, carga BD y rutas
├── db/
│   └── db.js                # Definición de la base de datos Dexie
├── store/
│   ├── useTransactionStore.js
│   ├── useCategoryStore.js
│   └── useSubcategoryStore.js
├── pages/
│   ├── Dashboard.jsx
│   ├── Movimientos.jsx
│   ├── Importar.jsx
│   ├── Categorias.jsx
│   └── Subcategorias.jsx
├── context/
│   └── ThemeContext.jsx      # Proveedor de tema oscuro/claro
├── hooks/
│   └── useDarkMode.js        # Toggle dark mode + persistencia en localStorage
├── utils/
│   ├── categorize.js        # Lógica de auto-categorización
│   └── importParsers.js     # Parsers CSV/Excel/Bankinter
└── components/
    ├── Layout.jsx
    └── Navbar.jsx
```

---

## Base de datos (Dexie / IndexedDB)

Base de datos: `CuadraFinances` — versión 1.

```
transactions
  id (PK), fechaContable, categoria, subcategoria,
  fechaValor, descripcion, importe, saldo,
  categoriaManual, subcategoriaManual

categories
  id (PK), nombre, palabrasClave[], palabrasExcluidas[],
  color, esTransferencia?, esIngreso?, _order?

subcategories
  id (PK), categoriaId, nombre, palabrasClave[], color
```

Cada transacción se almacena como registro individual (no como blob JSON). No hay límite práctico de almacenamiento.

---

## Stores (Zustand)

### useTransactionStore

| Acción | Descripción |
|---|---|
| `loadFromDB()` | Carga todas las transacciones de Dexie al arrancar |
| `addTransactions(rows)` | Añade transacciones únicas (deduplica por id); devuelve count añadidas |
| `updateTransaction(id, updates)` | Actualiza campos de una transacción |
| `bulkUpdateTransactions(map)` | Actualiza múltiples transacciones en una sola escritura a BD |
| `deleteTransaction(id)` | Borra una transacción |
| `clearAll()` | Borra todos los datos |
| `getByMonth(year, month)` | Filtra transacciones por mes (en memoria) |

### useCategoryStore

| Acción | Descripción |
|---|---|
| `loadFromDB()` | Carga categorías; si está vacío siembra las 16 por defecto; ejecuta migraciones |
| `addCategory(cat)` | Añade una categoría nueva |
| `updateCategory(id, updates)` | Actualiza nombre, keywords, exclusiones, color, flags |
| `reorderCategories(from, to)` | Reordena por drag & drop; persiste campo `_order` |
| `deleteCategory(id)` | Elimina una categoría |
| `getCategoryById(id)` | Búsqueda por id |
| `getCategoryByName(name)` | Búsqueda por nombre |

En `loadFromDB()` se ejecuta migración automática: garantiza que cat-14 tenga `esIngreso: true` y cat-16 `esTransferencia: true`.

### useSubcategoryStore

| Acción | Descripción |
|---|---|
| `loadFromDB()` | Carga subcategorías |
| `addSubcategory(sub)` | Añade subcategoría |
| `updateSubcategory(id, updates)` | Actualiza nombre, keywords, color |
| `deleteSubcategory(id)` | Elimina subcategoría |

---

## Categorías por defecto

| id | Nombre | Palabras clave | Flag |
|---|---|---|---|
| cat-1 | Mercadona | MERCADONA | |
| cat-2 | Carrefour | CARREFOUR | |
| cat-3 | Gasolina y Peajes | GASOLINA, PEAJE, REPSOL, BP | |
| cat-4 | Luz | ENDESA, IBERDROLA, NATURGY | |
| cat-5 | Agua | CANAL DE ISABEL, AGUAS DE | |
| cat-6 | Teléfono | MOVISTAR, VODAFONE, ORANGE, YOIGO | |
| cat-7 | Seguros | MUTUA, MAPFRE, ADESLAS, ASISA | |
| cat-8 | Educación | COLEGIO, ESCUELA, ACADEMIA | |
| cat-9 | Restaurantes | RESTAURANTE, CAFETERIA, BAR | |
| cat-10 | Amazon | AMAZON | |
| cat-11 | Plataformas | NETFLIX, SPOTIFY, HBO, DISNEY | |
| cat-12 | Farmacia | FARMACIA | |
| cat-13 | Médico | CLINICA, MEDICO, HOSPITAL | |
| cat-14 | Ingresos | NOMINA, TRANSFERENCIA RECIBIDA | `esIngreso: true` |
| cat-15 | Otros | (sin keywords — fallback) | |
| cat-16 | Transferencias internas | TRANSF INTERNA, TRASPASO | `esTransferencia: true` |

- `esTransferencia`: excluida de todos los cálculos (gastos e ingresos).
- `esIngreso`: excluida de los cálculos y tablas de gastos.

---

## Lógica de categorización (`src/utils/categorize.js`)

### `categorizeTransaction(descripcion, categories)`

1. Normaliza descripción: mayúsculas + colapsa espacios múltiples (`/\s+/g → ' '`).
2. Para cada categoría en orden:
   - Si la descripción contiene alguna palabra de `palabrasExcluidas` → salta esa categoría.
   - Si contiene alguna palabra de `palabrasClave` → devuelve el id de la categoría.
3. Fallback a la categoría "Otros" si existe.

### `categorizeSubcategory(descripcion, subcategories)`

Igual que el anterior pero sobre subcategorías. Devuelve id o null (sin fallback).

### `extractKeyword(descripcion)`

Elimina prefijos bancarios comunes (`PAGO BIZUM A`, `TRANSF /`, `RECIBO /`, `COMPRA`, `CARGO`) y devuelve la parte significativa (máx. 40 chars). Se usa para aprendizaje automático de keywords al asignar subcategoría manualmente.

### `autoCategorize(transactions, categories)`

Mapea un array de transacciones asignando categoría donde falta.

---

## Parser de importación (`src/utils/importParsers.js`)

### Formatos soportados

- **CSV** — PapaParse con headers automáticos.
- **XLSX / XLS** — XLSX.js. Detecta automáticamente el formato Bankinter.

### Detección Bankinter

Se considera formato Bankinter si la celda A1 contiene `"MOVIMIENTOS"` o empieza por `"ES"` (IBAN español).

### Parseo Bankinter

El fichero Bankinter tiene dos secciones:
- **Movimientos pendientes** (filas 5–12): 4 columnas (Fecha, Descripción, Importe, Divisa).
- **Sección principal** (fila ~20+): columnas completas incluyendo Fecha contable y Saldo.

El parser escanea buscando la fila de cabecera que contiene `"Fecha contable"`, luego filtra filas con fecha válida (patrón `DD/MM/YYYY`). Esto evita importar filas de metadatos como transacciones.

### Parseo de importes

- Si el valor de la celda Excel es un `number` → se usa directamente (evita bug de quitar puntos de miles).
- Si es string: detecta formato español `1.234,56` vs estándar `1234.56`.

### Parseo de fechas

Detecta y convierte: `DD/MM/YYYY`, `DD-MM-YYYY`, `YYYY-MM-DD` y fechas numéricas de Excel (días desde 1900).

### IDs de transacción

Generados como `tx-${Date.now()}-${index}-${random4hex}` para garantizar unicidad al reimportar.

---

## Páginas

### `/` — Dashboard

- Selector de año derivado de los datos.
- Tarjetas resumen: total gastos, total ingresos, balance, mes con más gasto.
- Gráfico de barras mensual (gastos vs ingresos).
- Gráfico de tarta / línea por categoría seleccionable (drill-down mensual). Colores de tarta en versión pastel (`toPastel()` mezcla el color de categoría con blanco al 55%).
- **Tabla gastos mensuales**: top 6 categorías de gasto × mes. Resalta máximo de columna solo si es único (no si todos los meses son iguales).
- **Tabla ingresos mensuales**: solo categorías `esIngreso`. Columnas = subcategorías definidas para esas categorías (o la categoría entera si no hay subcategorías).
- **Comparativa anual** (visible cuando hay datos de más de un año): gráfico de barras agrupadas por año + tabla con gastos, ingresos y balance de cada año, con variación % respecto al año anterior. Subida de gastos → rojo; bajada de gastos → verde. Subida de ingresos → verde; bajada → rojo. El año activo se resalta.
- **Desglose por categoría** (al final): filas anidadas de subcategorías colapsables, con barra de % proporcional. Máximo 8 filas visibles con scroll. Usa dos `<table>` con `<colgroup>` idénticos para alinear cabecera y cuerpo con scroll independiente.

Excluye de todos los cálculos: `esTransferencia`. Excluye de gastos: `esIngreso`.

### `/movimientos` — Movimientos

- Tabla paginada (20/página).
- Filtros: mes, categoría (alfabético), texto libre en descripción.
- Selector de categoría por fila (asignación manual → `categoriaManual: true`).
- **Selección múltiple**: checkbox por fila + checkbox de cabecera para seleccionar toda la página. Al seleccionar uno o más, aparece una barra de acción con selector de categoría y botón "Aplicar". Usa `bulkUpdateTransactions` con `categoriaManual: true`. Las descripciones de estos movimientos **no** se evalúan para sugerir ni añadir etiquetas a categorías.

### `/importar` — Importar

- Flujo en 4 pasos: subir fichero → mapear columnas → vista previa → confirmar.
- Drag & drop o click para seleccionar fichero.
- Auto-mapeo de columnas por nombre heurístico.
- Categorización automática en vista previa.
- Botón "Borrar todos los datos" con confirmación doble.

### `/categorias` — Categorías

- Tarjetas arrastrables (HTML5 drag & drop) para reordenar.
- Edición inline: nombre, color (paleta + picker libre), palabras clave (chips editables), excepciones, flag transferencia interna.
- **Palabras clave**: chips clicables para editar inline. Entrada con Enter/coma para añadir.
- **Excepciones** (`palabrasExcluidas`): si la descripción contiene esta cadena, la categoría se salta aunque tenga keyword coincidente. Se muestran en rojo con prefijo `≠`.
- **Panel de sugerencias** (ámbar): keywords candidatas derivadas de asignaciones manuales no cubiertas. Botón `+` para añadir, `×` para descartar (descartadas persisten en `localStorage` bajo clave `cuadra-dismissed-suggestions`).
- **Re-categorizar todo**: usa `bulkUpdateTransactions` para una sola escritura a BD. Respeta `categoriaManual: true`.

### `/subcategorias` — Subcategorías

- Panel izquierdo: lista de categorías **ordenada alfabéticamente** con contador de subcategorías.
- Panel derecho: subcategorías + tabla de movimientos de esa categoría.
- **Gestión de etiquetas con chips**: las palabras clave se muestran como chips en vista normal y se editan con el componente `KeywordEditor` (Enter o coma para añadir, × para eliminar, Backspace para borrar el último). Se normalizan a mayúsculas automáticamente. Igual tanto al editar una subcategoría existente como al crear una nueva.
- Selector de color al crear y al editar.
- **Auto-aprendizaje**: al asignar manualmente una subcategoría, `extractKeyword` añade la keyword si no existía.
- **Auto-asignar**: aplica `categorizeSubcategory` en lote sobre movimientos no manuales.
- Filtros en la tabla: año, mes, subcategoría, texto.

---

## Decisiones de diseño relevantes

- **IndexedDB vía Dexie** en lugar de `localStorage`: sin límite práctico de almacenamiento, escrituras async, registros individuales por transacción en vez de un blob JSON gigante que se reescribía entero en cada cambio.
- **`bulkUpdateTransactions`**: la re-categorización masiva hace una sola escritura a BD en lugar de N escrituras, evitando bloquear el hilo principal y múltiples re-renders.
- **`categoriaManual` / `subcategoriaManual`**: flag en la transacción para proteger asignaciones manuales frente a re-categorizaciones automáticas.
- **`palabrasExcluidas`**: permite manejar excepciones sin reordenar categorías. Ejemplo: "COLEGIO DE REGISTRADORES" no entra en Educación aunque tenga la keyword "COLEGIO".
- **Normalización de whitespace**: tanto descripción como keywords se normalizan con `/\s+/g → ' '` antes de comparar. Bankinter inserta dobles espacios en nombres de contactos Bizum.
- **`esIngreso` / `esTransferencia`**: flags en categoría para excluir del cálculo de gastos sin depender del signo del importe (una transacción en categoría "Ingresos" con importe negativo no contamina el desglose de gastos).
- **Resaltado de máximo en tablas**: solo se resalta si el valor máximo es único en esa columna — si todos los meses tienen el mismo importe no se marca ninguno.
- **Tema oscuro**: estrategia CSS-first con selectores `html.dark .clase-tailwind` en `index.css`. Los componentes no necesitan `dark:` variants; el cambio de clase en `<html>` es suficiente para cubrir el 95% de la UI. Para elementos que usan colores en props de Recharts (ejes, grid, cursor, tooltips) se lee `dark` del contexto y se pasan valores condicionales directamente.

---

## Tema oscuro

Activado mediante el botón ☀️/🌙 en la Navbar.

### Paleta dark

| Rol | Color |
|---|---|
| Fondo body / dashboard | `#1a2e38` |
| Cards / bg-white | `#233d4c` |
| Elevado / hover / inputs | `#2d5264` |
| Bordes | `#3a6070` |
| Texto principal | `#f0f8fc` |
| Texto secundario | `#d8eef6` |
| Texto tenue | `#82b4c8` |
| Acento (naranja) | `#fd802e` |
| Fondo de acento | `#3d2210` |

### Implementación

- `src/hooks/useDarkMode.js` — estado booleano `dark`, aplica/elimina clase `dark` en `<html>`, persiste en `localStorage` bajo clave `cuadra-theme`, respeta `prefers-color-scheme` del sistema como valor inicial.
- `src/context/ThemeContext.jsx` — `ThemeProvider` expone `{ dark, setDark }` vía contexto. `App.jsx` envuelve toda la app con él.
- `src/index.css` — sobreescrituras globales `html.dark .clase {}` para todas las utilidades Tailwind usadas en la app (backgrounds, textos, bordes, inputs, gradientes, sombras, tintes pastel).
- `src/components/Navbar.jsx` — consume `useTheme()` para el botón toggle y para colorear el cursor/ejes de los gráficos Recharts.
- `src/pages/Dashboard.jsx` — consume `useTheme()` para pasar colores condicionales a props de Recharts (CartesianGrid stroke, XAxis/YAxis tick fill, Tooltip cursor, tooltips custom).
