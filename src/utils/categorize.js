/**
 * Auto-categorize a transaction based on its descripcion.
 * Returns the category id of the first matching category, or null.
 */
export function categorizeTransaction(descripcion, categories) {
  if (!descripcion) return null
  const upper = descripcion.toUpperCase().replace(/\s+/g, ' ').trim()

  for (const category of categories) {
    // Check exclusions first — if description matches any exclusion keyword, skip this category
    const excluded = (category.palabrasExcluidas || []).some(
      (ex) => ex && upper.includes(ex.toUpperCase().replace(/\s+/g, ' ').trim())
    )
    if (excluded) continue

    for (const keyword of category.palabrasClave) {
      if (keyword && upper.includes(keyword.toUpperCase().replace(/\s+/g, ' ').trim())) {
        return category.id
      }
    }
  }

  // Fall back to "Otros" if it exists
  const otros = categories.find((c) => c.nombre === 'Otros')
  return otros ? otros.id : null
}

/**
 * Auto-assign a subcategory based on keywords. Returns subcategory id or null.
 */
export function categorizeSubcategory(descripcion, subcategories) {
  if (!descripcion) return null
  const upper = descripcion.toUpperCase().replace(/\s+/g, ' ').trim()
  for (const sub of subcategories) {
    for (const kw of sub.palabrasClave) {
      if (kw && upper.includes(kw.toUpperCase().replace(/\s+/g, ' ').trim())) return sub.id
    }
  }
  return null
}

/**
 * Extract a candidate keyword from a transaction description.
 * Strips common prefixes (BIZUM, TRANSF, RECIBO...) and returns
 * the meaningful part, uppercased, max 40 chars.
 */
export function extractKeyword(descripcion) {
  if (!descripcion) return null
  const upper = descripcion.toUpperCase().replace(/\s+/g, ' ').trim()
  const cleaned = upper
    .replace(/^PAGO BIZUM A /, '')
    .replace(/^TRANSF? \//, '')
    .replace(/^RECIB[OI]? \//, '')
    .replace(/^COMPRA /, '')
    .replace(/^CARGO /, '')
    .split(/\s{2,}|\d{2}\/\d{2}\/\d{2,4}/)[0]
    .trim()
    .slice(0, 40)
  return cleaned.length >= 3 ? cleaned : null
}

/**
 * Apply auto-categorization to a list of transactions.
 */
export function autoCategorize(transactions, categories, subcategories = []) {
  return transactions.map((t) => {
    const catId = t.categoria || categorizeTransaction(t.descripcion, categories)
    const relevantSubs = catId
      ? subcategories.filter((s) => s.categoriaId === catId)
      : subcategories
    const subId = t.subcategoria || categorizeSubcategory(t.descripcion, relevantSubs)
    return { ...t, categoria: catId, subcategoria: subId }
  })
}
