use std::path::Path;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::{DialogExt, FilePath};

use crate::error::map_error;
use crate::file_ops::{
    read_file as read_markdown_file, read_metadata, write_file as write_markdown_file, FileContent,
    FileMetadata,
};
use crate::menu;
use crate::settings::{
    AppSettingsState, Preferences, PreferencesUpdate, RecentFile, SessionState, SessionUpdate,
};
use crate::utils::path::validate_markdown_path;

#[tauri::command]
pub async fn greet(name: String) -> Result<String, String> {
    Ok(format!("Hello, {name}! Welcome to LucidMark."))
}

#[tauri::command]
pub async fn open_file_dialog(app: AppHandle) -> Result<Option<String>, String> {
    let handle = app.clone();
    let selection = tauri::async_runtime::spawn_blocking(move || {
        handle
            .dialog()
            .file()
            .set_title("Open Markdown File")
            .add_filter("Markdown", &["md", "markdown", "mdown"])
            .blocking_pick_file()
            .and_then(convert_file_path)
    })
    .await
    .map_err(|err| err.to_string())?;

    Ok(selection)
}

#[tauri::command]
pub async fn save_file_dialog(
    app: AppHandle,
    default_name: Option<String>,
) -> Result<Option<String>, String> {
    let handle = app.clone();
    let selection = tauri::async_runtime::spawn_blocking(move || {
        let mut builder = handle
            .dialog()
            .file()
            .set_title("Save Markdown File")
            .add_filter("Markdown", &["md", "markdown", "mdown"]);

        if let Some(name) = default_name {
            builder = builder.set_file_name(name);
        }

        builder.blocking_save_file().and_then(convert_file_path)
    })
    .await
    .map_err(|err| err.to_string())?;

    Ok(selection)
}

#[tauri::command]
pub async fn read_file(
    app: AppHandle,
    path: String,
    settings: State<'_, AppSettingsState>,
) -> Result<FileContent, String> {
    let content = map_error(read_markdown_file(&path).await)?;
    settings
        .add_recent_file(content.to_metadata())
        .await
        .map_err(|err| err.to_string())?;
    let recents = settings.list_recent_files().await;
    menu::rebuild(&app, &recents).map_err(|err| err.to_string())?;
    Ok(content)
}

#[tauri::command]
pub async fn write_file(
    app: AppHandle,
    path: String,
    content: String,
    settings: State<'_, AppSettingsState>,
) -> Result<FileMetadata, String> {
    let metadata = map_error(write_markdown_file(&path, &content).await)?;
    settings
        .add_recent_file(metadata.clone())
        .await
        .map_err(|err| err.to_string())?;
    let recents = settings.list_recent_files().await;
    menu::rebuild(&app, &recents).map_err(|err| err.to_string())?;
    Ok(metadata)
}

#[tauri::command]
pub async fn get_recent_files(
    settings: State<'_, AppSettingsState>,
) -> Result<Vec<RecentFile>, String> {
    Ok(settings.list_recent_files().await)
}

#[tauri::command]
pub async fn add_recent_file(
    app: AppHandle,
    path: String,
    settings: State<'_, AppSettingsState>,
) -> Result<(), String> {
    let path_buf = map_error(validate_markdown_path(Path::new(&path)))?;
    let metadata = map_error(read_metadata(&path_buf).await)?;
    settings
        .add_recent_file(metadata)
        .await
        .map_err(|err| err.to_string())?;
    let recents = settings.list_recent_files().await;
    menu::rebuild(&app, &recents).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn remove_recent_file(
    app: AppHandle,
    path: String,
    settings: State<'_, AppSettingsState>,
) -> Result<(), String> {
    settings
        .remove_recent_file(&path)
        .await
        .map_err(|err| err.to_string())?;
    let recents = settings.list_recent_files().await;
    menu::rebuild(&app, &recents).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn clear_recent_files(
    app: AppHandle,
    settings: State<'_, AppSettingsState>,
) -> Result<(), String> {
    settings
        .clear_recent_files()
        .await
        .map_err(|err| err.to_string())?;
    let recents = settings.list_recent_files().await;
    menu::rebuild(&app, &recents).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn get_preferences(settings: State<'_, AppSettingsState>) -> Result<Preferences, String> {
    Ok(settings.get_preferences().await)
}

#[tauri::command]
pub async fn save_preferences(
    settings: State<'_, AppSettingsState>,
    update: PreferencesUpdate,
) -> Result<Preferences, String> {
    settings
        .update_preferences(update)
        .await
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn get_session_state(
    settings: State<'_, AppSettingsState>,
) -> Result<SessionState, String> {
    Ok(settings.get_session_state().await)
}

#[tauri::command]
pub async fn save_session_state(
    settings: State<'_, AppSettingsState>,
    update: SessionUpdate,
) -> Result<SessionState, String> {
    settings
        .update_session_state(update)
        .await
        .map_err(|err| err.to_string())
}

fn convert_file_path(file_path: FilePath) -> Option<String> {
    match file_path {
        FilePath::Path(path) => Some(path.to_string_lossy().into_owned()),
        FilePath::Url(url) => url
            .to_file_path()
            .ok()
            .map(|path| path.to_string_lossy().into_owned())
            .or_else(|| Some(url.to_string())),
    }
}
