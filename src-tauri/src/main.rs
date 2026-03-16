#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(not(debug_assertions))]
use tauri::Manager;

fn main() {
  #[cfg(not(debug_assertions))]
  fn start_backend(app: &tauri::App) {
    use std::fs::create_dir_all;
    use std::process::Command;

    let resource_dir = match app.path().resource_dir() {
      Ok(path) => path,
      Err(err) => {
        eprintln!("Failed to resolve resource dir: {err}");
        return;
      }
    };

    #[cfg(target_os = "windows")]
    let backend_file = "bracketeer-server.exe";
    #[cfg(not(target_os = "windows"))]
    let backend_file = "bracketeer-server";

    let mut backend_path = resource_dir.join("resources").join(backend_file);
    if !backend_path.exists() {
      backend_path = resource_dir.join(backend_file);
    }

    if !backend_path.exists() {
      eprintln!("Backend binary not found at {:?}", backend_path);
      return;
    }

    let app_data_dir = match app.path().app_data_dir() {
      Ok(path) => path,
      Err(err) => {
        eprintln!("Failed to resolve app data dir: {err}");
        return;
      }
    };

    if let Err(err) = create_dir_all(&app_data_dir) {
      eprintln!("Failed to create app data dir: {err}");
      return;
    }

    let db_path = app_data_dir.join("app.db");

    if let Err(err) = Command::new(&backend_path)
      .env("BRACKETEER_DB_PATH", db_path)
      .env("BRACKETEER_PORT", "31337")
      .spawn()
    {
      eprintln!("Failed to start backend process: {err}");
    }
  }

  tauri::Builder::default()
    .setup(|_app| {
      #[cfg(not(debug_assertions))]
      start_backend(_app);
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
