#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(not(debug_assertions))]
use std::net::TcpListener;
#[cfg(not(debug_assertions))]
use std::process::{Child, Command};
#[cfg(not(debug_assertions))]
use std::sync::Mutex;
#[cfg(not(debug_assertions))]
use tauri::Manager;

#[cfg(not(debug_assertions))]
struct BackendState {
  child: Mutex<Option<Child>>,
}

fn main() {
  #[cfg(not(debug_assertions))]
  fn choose_backend_port() -> Option<u16> {
    for port in 31337..=31347 {
      if let Ok(listener) = TcpListener::bind(("127.0.0.1", port)) {
        drop(listener);
        return Some(port);
      }
    }
    None
  }

  #[cfg(not(debug_assertions))]
  fn start_backend(app: &tauri::App) -> Option<BackendState> {
    use std::fs::create_dir_all;

    let resource_dir = match app.path().resource_dir() {
      Ok(path) => path,
      Err(err) => {
        eprintln!("Failed to resolve resource dir: {err}");
        return None;
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
      return None;
    }

    let app_data_dir = match app.path().app_data_dir() {
      Ok(path) => path,
      Err(err) => {
        eprintln!("Failed to resolve app data dir: {err}");
        return None;
      }
    };

    if let Err(err) = create_dir_all(&app_data_dir) {
      eprintln!("Failed to create app data dir: {err}");
      return None;
    }

    let db_path = app_data_dir.join("app.db");
    let port = match choose_backend_port() {
      Some(value) => value,
      None => {
        eprintln!("No available backend port found in 31337-31347");
        return None;
      }
    };

    let mut command = Command::new(&backend_path);
    command
      .env("BRACKETEER_DB_PATH", db_path)
      .env("BRACKETEER_PORT", port.to_string());

    #[cfg(target_os = "windows")]
    {
      use std::os::windows::process::CommandExt;
      const CREATE_NO_WINDOW: u32 = 0x0800_0000;
      command.creation_flags(CREATE_NO_WINDOW);
    }

    match command.spawn() {
      Ok(child) => Some(BackendState {
        child: Mutex::new(Some(child)),
      }),
      Err(err) => {
        eprintln!("Failed to start backend process: {err}");
        None
      }
    }
  }

  let builder = tauri::Builder::default().setup(|_app| {
      #[cfg(not(debug_assertions))]
      if let Some(state) = start_backend(_app) {
        _app.manage(state);
      }
      Ok(())
    });

  let app = builder
    .build(tauri::generate_context!())
    .expect("error while running tauri application");

  app.run(|_app_handle, _event| {
    #[cfg(not(debug_assertions))]
    if matches!(_event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
      if let Some(state) = _app_handle.try_state::<BackendState>() {
        if let Ok(mut slot) = state.child.lock() {
          if let Some(mut child) = slot.take() {
            let _ = child.kill();
            let _ = child.wait();
          }
        }
      }
    }
  });
}
