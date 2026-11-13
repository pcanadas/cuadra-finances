//! Versión de Microsoft Store: la Store instala las actualizaciones, pero la app avisa cuando hay
//! una (como hace el actualizador propio en la versión de GitHub) y abre su ficha en la Store.
//! Fuera de un paquete MSIX (sin identidad de paquete) la Store no responde: se devuelve error.

use windows::Foundation::Uri;
use windows::Services::Store::StoreContext;
use windows::System::Launcher;
use windows::core::HSTRING;

const STORE_PAGE: &str = "ms-windows-store://pdp/?productid=9NLLQLF0SRTX";

fn updates_pending() -> windows::core::Result<bool> {
  let context = StoreContext::GetDefault()?;
  let updates = context.GetAppAndOptionalStorePackageUpdatesAsync()?.join()?;
  Ok(updates.Size()? > 0)
}

/// ¿Tiene la Store una versión más nueva de la app?
#[tauri::command]
pub async fn store_update_available() -> Result<bool, String> {
  tauri::async_runtime::spawn_blocking(updates_pending)
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// Abre la ficha de Zenit en la Store (desde ahí se actualiza).
#[tauri::command]
pub async fn open_store_page() -> Result<(), String> {
  tauri::async_runtime::spawn_blocking(|| -> windows::core::Result<bool> {
    let uri = Uri::CreateUri(&HSTRING::from(STORE_PAGE))?;
    Launcher::LaunchUriAsync(&uri)?.join()
  })
  .await
  .map_err(|e| e.to_string())?
  .map(|_| ())
  .map_err(|e| e.to_string())
}
