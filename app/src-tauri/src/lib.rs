use std::sync::Mutex;
use tauri::{Emitter, Manager};

/// Beim Start übergebene Projektdatei (Doppelklick auf eine .we13-Datei im Explorer).
struct StartupFile(Mutex<Option<String>>);

/// Erstes Argument, das auf eine vorhandene Projektdatei zeigt.
fn project_arg<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter().skip(1).find(|a| {
        let l = a.to_lowercase();
        (l.ends_with(".we13") || l.ends_with(".json")) && std::path::Path::new(a).is_file()
    })
}

/// Liefert die Startdatei genau einmal (danach None).
#[tauri::command]
fn startup_file(state: tauri::State<StartupFile>) -> Option<String> {
    state.0.lock().ok().and_then(|mut f| f.take())
}

/// Fensterhintergrund: "mica" unter Windows 11, sonst None (die Oberfläche zeichnet ihren eigenen Verlauf).
#[tauri::command]
fn backdrop_kind(window: tauri::WebviewWindow) -> Option<String> {
    #[cfg(windows)]
    {
        if window_vibrancy::apply_mica(&window, None).is_ok() {
            return Some("mica".into());
        }
    }
    let _ = window;
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Zweiter Start (z. B. Doppelklick auf eine weitere .we13-Datei): Datei an das laufende Fenster geben
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
            if let Some(path) = project_arg(argv) {
                let _ = app.emit("open-file", path);
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(StartupFile(Mutex::new(project_arg(std::env::args()))))
        .invoke_handler(tauri::generate_handler![startup_file, backdrop_kind])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten des Einrichtungsplaners");
}
