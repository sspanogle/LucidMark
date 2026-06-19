mod commands;
mod error;
mod file_ops;
mod menu;
mod settings;
mod utils;

use std::time::Duration;

use settings::{AppSettingsState, STORE_FILE};
use tauri::Manager;
use tauri_plugin_store::StoreExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let store = app
                .store_builder(STORE_FILE)
                .auto_save(Duration::from_secs(2))
                .build()?;

            settings::record_initial_launch(&store)?;
            let (recents, preferences, session) = settings::hydrate_state(&store);
            menu::initialize(&app.handle(), &recents)?;
            let state = AppSettingsState::new(store, recents, preferences, session)?;

            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::open_file_dialog,
            commands::save_file_dialog,
            commands::read_file,
            commands::write_file,
            commands::get_recent_files,
            commands::add_recent_file,
            commands::remove_recent_file,
            commands::clear_recent_files,
            commands::get_preferences,
            commands::save_preferences,
            commands::get_session_state,
            commands::save_session_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
