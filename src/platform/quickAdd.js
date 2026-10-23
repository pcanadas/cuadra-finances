// Abre el alta rápida (la gestiona Navbar) desde cualquier pantalla
export const QUICK_ADD_EVENT = 'cuadra:quick-add'

export function openQuickAdd() {
  window.dispatchEvent(new Event(QUICK_ADD_EVENT))
}
