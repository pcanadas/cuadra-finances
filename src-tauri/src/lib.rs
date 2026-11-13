#[cfg(windows)]
mod store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[allow(unused_mut)]
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init());

  // Bloqueo con huella o PIN del móvil (src/platform/appLock.js)
  #[cfg(target_os = "android")]
  {
    builder = builder.plugin(tauri_plugin_biometric::init());
  }

  #[cfg(not(target_os = "android"))]
  {
    builder = builder
      .plugin(tauri_plugin_updater::Builder::new().build())
      .plugin(tauri_plugin_process::init());
  }

  #[cfg(windows)]
  {
    builder = builder.invoke_handler(tauri::generate_handler![store::store_update_available, store::open_store_page]);
  }

  builder
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
