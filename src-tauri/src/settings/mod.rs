use std::collections::VecDeque;
use std::sync::Arc;
use std::time::SystemTime;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::RwLock;

use crate::error::{AppError, Result};
use crate::file_ops::FileMetadata;

pub const STORE_FILE: &str = "lucidmark-store.json";

const RECENT_FILES_LIMIT: usize = 20;
const RECENT_FILES_KEY: &str = "recentFiles";
const PREFERENCES_KEY: &str = "preferences";
const SESSION_KEY: &str = "session";
const META_KEY: &str = "meta";

pub type StoreHandle = Arc<tauri_plugin_store::Store<tauri::Wry>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
    pub path: String,
    pub size: u64,
    pub last_modified: String,
}

impl RecentFile {
    fn from_metadata(metadata: &FileMetadata) -> Self {
        Self {
            path: metadata.path.clone(),
            size: metadata.size,
            last_modified: metadata.last_modified.to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    Light,
    Dark,
    System,
}

impl Default for ThemePreference {
    fn default() -> Self {
        Self::System
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorPreferences {
    pub font_family: String,
    pub font_size: u16,
    pub show_line_numbers: bool,
    pub soft_wrap: bool,
}

impl Default for EditorPreferences {
    fn default() -> Self {
        Self {
            font_family: "system-ui".into(),
            font_size: 14,
            show_line_numbers: true,
            soft_wrap: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewPreferences {
    pub enable_math: bool,
    pub enable_diagrams: bool,
    pub enable_syntax_highlighting: bool,
}

impl Default for PreviewPreferences {
    fn default() -> Self {
        Self {
            enable_math: true,
            enable_diagrams: true,
            enable_syntax_highlighting: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoSavePreferences {
    pub enabled: bool,
    pub interval_ms: u64,
}

impl Default for AutoSavePreferences {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_ms: 2000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub theme: ThemePreference,
    pub editor: EditorPreferences,
    pub preview: PreviewPreferences,
    pub auto_save: AutoSavePreferences,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            theme: ThemePreference::default(),
            editor: EditorPreferences::default(),
            preview: PreviewPreferences::default(),
            auto_save: AutoSavePreferences::default(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PreferencesUpdate {
    pub theme: Option<ThemePreference>,
    #[serde(default)]
    pub editor: Option<EditorPreferencesUpdate>,
    #[serde(default)]
    pub preview: Option<PreviewPreferencesUpdate>,
    #[serde(default)]
    pub auto_save: Option<AutoSavePreferencesUpdate>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EditorPreferencesUpdate {
    pub font_family: Option<String>,
    pub font_size: Option<u16>,
    pub show_line_numbers: Option<bool>,
    pub soft_wrap: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PreviewPreferencesUpdate {
    pub enable_math: Option<bool>,
    pub enable_diagrams: Option<bool>,
    pub enable_syntax_highlighting: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AutoSavePreferencesUpdate {
    pub enabled: Option<bool>,
    pub interval_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WindowState {
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub maximized: bool,
    pub fullscreen: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSession {
    pub path: Option<String>,
    pub content: String,
    pub cursor: Option<CursorPosition>,
    pub dirty: bool,
    pub temporary_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionState {
    pub last_opened_file: Option<String>,
    pub window: Option<WindowState>,
    pub active_document: Option<String>,
    pub documents: Vec<DocumentSession>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WindowStateUpdate {
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub x: Option<Option<f64>>,
    pub y: Option<Option<f64>>,
    pub maximized: Option<bool>,
    pub fullscreen: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionUpdate {
    pub last_opened_file: Option<Option<String>>,
    #[serde(default)]
    pub window: Option<WindowStateUpdate>,
    #[serde(default)]
    pub clear_window: bool,
    pub active_document: Option<Option<String>>,
    #[serde(default)]
    pub documents: Option<Vec<DocumentSession>>,
    #[serde(default)]
    pub clear_documents: bool,
}

pub struct AppSettingsState {
    store: StoreHandle,
    recent_files: RwLock<VecDeque<RecentFile>>,
    preferences: RwLock<Preferences>,
    session: RwLock<SessionState>,
}

impl AppSettingsState {
    pub fn new(
        store: StoreHandle,
        initial_recents: Vec<RecentFile>,
        initial_preferences: Preferences,
        initial_session: SessionState,
    ) -> Result<Self> {
        let state = Self {
            store: store.clone(),
            recent_files: RwLock::new(VecDeque::from(initial_recents.clone())),
            preferences: RwLock::new(initial_preferences.clone()),
            session: RwLock::new(initial_session.clone()),
        };

        state.persist_recents(&initial_recents)?;
        state.persist_preferences(&initial_preferences)?;
        state.persist_session(&initial_session)?;

        Ok(state)
    }

    pub async fn list_recent_files(&self) -> Vec<RecentFile> {
        self.recent_files.read().await.iter().cloned().collect()
    }

    pub fn recent_file_by_index(&self, index: usize) -> Option<RecentFile> {
        tauri::async_runtime::block_on(async { self.recent_files.read().await.get(index).cloned() })
    }

    pub async fn add_recent_file(&self, metadata: FileMetadata) -> Result<()> {
        let recent = RecentFile::from_metadata(&metadata);
        let mut entries = self.recent_files.write().await;
        entries.retain(|entry| entry.path != recent.path);
        entries.push_front(recent);

        while entries.len() > RECENT_FILES_LIMIT {
            entries.pop_back();
        }

        let snapshot: Vec<RecentFile> = entries.iter().cloned().collect();
        drop(entries);
        self.persist_recents(&snapshot)
    }

    pub async fn get_preferences(&self) -> Preferences {
        self.preferences.read().await.clone()
    }

    pub async fn update_preferences(&self, update: PreferencesUpdate) -> Result<Preferences> {
        let mut prefs = self.preferences.write().await;

        if let Some(theme) = update.theme {
            prefs.theme = theme;
        }

        if let Some(editor) = update.editor {
            if let Some(font_family) = editor.font_family {
                prefs.editor.font_family = font_family;
            }
            if let Some(font_size) = editor.font_size {
                prefs.editor.font_size = font_size;
            }
            if let Some(show_line_numbers) = editor.show_line_numbers {
                prefs.editor.show_line_numbers = show_line_numbers;
            }
            if let Some(soft_wrap) = editor.soft_wrap {
                prefs.editor.soft_wrap = soft_wrap;
            }
        }

        if let Some(preview) = update.preview {
            if let Some(enable_math) = preview.enable_math {
                prefs.preview.enable_math = enable_math;
            }
            if let Some(enable_diagrams) = preview.enable_diagrams {
                prefs.preview.enable_diagrams = enable_diagrams;
            }
            if let Some(enable_syntax_highlighting) = preview.enable_syntax_highlighting {
                prefs.preview.enable_syntax_highlighting = enable_syntax_highlighting;
            }
        }

        if let Some(auto_save) = update.auto_save {
            if let Some(enabled) = auto_save.enabled {
                prefs.auto_save.enabled = enabled;
            }
            if let Some(interval_ms) = auto_save.interval_ms {
                prefs.auto_save.interval_ms = interval_ms;
            }
        }

        let snapshot = prefs.clone();
        drop(prefs);
        self.persist_preferences(&snapshot)?;
        Ok(snapshot)
    }

    pub async fn get_session_state(&self) -> SessionState {
        self.session.read().await.clone()
    }

    pub async fn update_session_state(&self, update: SessionUpdate) -> Result<SessionState> {
        let mut session = self.session.write().await;

        if let Some(last_opened_file) = update.last_opened_file {
            session.last_opened_file = last_opened_file;
        }

        if let Some(active_document) = update.active_document {
            session.active_document = active_document;
        }

        if update.clear_documents {
            session.documents.clear();
        }

        if let Some(documents) = update.documents {
            session.documents = documents;
        }

        if update.clear_window {
            session.window = None;
        } else if let Some(window_update) = update.window {
            let mut window = session.window.clone().unwrap_or_default();
            let mut touched = false;

            if let Some(width) = window_update.width {
                window.width = width;
                touched = true;
            }
            if let Some(height) = window_update.height {
                window.height = height;
                touched = true;
            }
            if let Some(x) = window_update.x {
                window.x = x;
                touched = true;
            }
            if let Some(y) = window_update.y {
                window.y = y;
                touched = true;
            }
            if let Some(maximized) = window_update.maximized {
                window.maximized = maximized;
                touched = true;
            }
            if let Some(fullscreen) = window_update.fullscreen {
                window.fullscreen = fullscreen;
                touched = true;
            }

            if touched {
                session.window = Some(window);
            }
        }

        let snapshot = session.clone();
        drop(session);
        self.persist_session(&snapshot)?;
        Ok(snapshot)
    }

    fn persist_recents(&self, recents: &[RecentFile]) -> Result<()> {
        let value = serde_json::to_value(recents)?;
        self.store.set(RECENT_FILES_KEY, value);
        self.store
            .save()
            .map_err(|err| AppError::Internal(err.to_string()))
    }

    fn persist_preferences(&self, preferences: &Preferences) -> Result<()> {
        let value = serde_json::to_value(preferences)?;
        self.store.set(PREFERENCES_KEY, value);
        self.store
            .save()
            .map_err(|err| AppError::Internal(err.to_string()))
    }

    fn persist_session(&self, session: &SessionState) -> Result<()> {
        let value = serde_json::to_value(session)?;
        self.store.set(SESSION_KEY, value);
        self.store
            .save()
            .map_err(|err| AppError::Internal(err.to_string()))
    }
}

pub fn hydrate_state(store: &StoreHandle) -> (Vec<RecentFile>, Preferences, SessionState) {
    let recents = store
        .get(RECENT_FILES_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default();

    let preferences = store
        .get(PREFERENCES_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default();

    let session = store
        .get(SESSION_KEY)
        .and_then(|value| serde_json::from_value(value).ok())
        .unwrap_or_default();

    (recents, preferences, session)
}

pub fn record_initial_launch(store: &StoreHandle) -> Result<()> {
    if !store.has(META_KEY) {
        store.set(
            META_KEY,
            json!({
                "createdAt": DateTime::<Utc>::from(SystemTime::now()).to_rfc3339(),
            }),
        );
        store
            .save()
            .map_err(|err| AppError::Internal(err.to_string()))?;
    }

    Ok(())
}
