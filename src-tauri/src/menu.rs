use std::path::Path;

use tauri::menu::{Menu, MenuBuilder, MenuItem, Submenu, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, Wry};

use crate::settings::{AppSettingsState, RecentFile};

const FILE_MENU_ID: &str = "menu-file";
const MENU_ITEM_OPEN: &str = "menu-file-open";
const MENU_ITEM_QUIT: &str = "menu-file-quit";
const OPEN_RECENT_MENU_ID: &str = "menu-file-open-recent";
const OPEN_RECENT_PREFIX: &str = "menu-file-open-recent-";
const MAX_RECENT_MENU_ITEMS: usize = 10;
const EVENT_OPEN: &str = "menu://open-markdown";
const EVENT_OPEN_RECENT: &str = "menu://open-recent";

pub fn initialize(app: &AppHandle, initial_recents: &[RecentFile]) -> tauri::Result<()> {
    let menu = build_menu(app, initial_recents)?;
    app.set_menu(menu)?;

    app.on_menu_event(move |handle, event| {
        let id = event.id().as_ref();
        if id == MENU_ITEM_OPEN {
            if let Err(reason) = handle.emit(EVENT_OPEN, ()) {
                eprintln!("failed to emit open markdown menu event: {reason}");
            }
            return;
        }

        if id == MENU_ITEM_QUIT {
            handle.exit(0);
            return;
        }

        if let Some(index_str) = id.strip_prefix(OPEN_RECENT_PREFIX) {
            if let Ok(index) = index_str.parse::<usize>() {
                if let Some(recent) = handle
                    .state::<AppSettingsState>()
                    .recent_file_by_index(index)
                {
                    if let Err(reason) = handle.emit(EVENT_OPEN_RECENT, recent.path) {
                        eprintln!(
                            "failed to emit open recent menu event for index {index}: {reason}"
                        );
                    }
                }
            }
            return;
        }
    });

    Ok(())
}

pub fn rebuild(app: &AppHandle, recents: &[RecentFile]) -> tauri::Result<()> {
    let menu = build_menu(app, recents)?;
    app.set_menu(menu)?;
    Ok(())
}

fn build_menu(app: &AppHandle, recents: &[RecentFile]) -> tauri::Result<Menu<Wry>> {
    let file_submenu = build_file_submenu(app, recents)?;

    MenuBuilder::new(app).item(&file_submenu).build()
}

fn build_file_submenu(app: &AppHandle, recents: &[RecentFile]) -> tauri::Result<Submenu<Wry>> {
    let open_recent = build_open_recent_submenu(app, recents)?;

    SubmenuBuilder::with_id(app, FILE_MENU_ID, "File")
        .text(MENU_ITEM_OPEN, "Open Markdown…")
        .item(&open_recent)
        .separator()
        .text(MENU_ITEM_QUIT, "Quit LucidMark")
        .build()
}

fn build_open_recent_submenu(
    app: &AppHandle,
    recents: &[RecentFile],
) -> tauri::Result<Submenu<Wry>> {
    let mut builder = SubmenuBuilder::with_id(app, OPEN_RECENT_MENU_ID, "Open Recent");

    if recents.is_empty() {
        let empty = MenuItem::with_id(
            app,
            "menu-file-open-recent-empty",
            "No recent files",
            false,
            None::<&str>,
        )?;
        builder = builder.item(&empty);
        return builder.build();
    }

    for (index, recent) in recents.iter().take(MAX_RECENT_MENU_ITEMS).enumerate() {
        let display_name = file_display_name(&recent.path);
        let id = format!("{OPEN_RECENT_PREFIX}{index}");
        let item = MenuItem::with_id(app, id, display_name, true, None::<&str>)?;
        builder = builder.item(&item);
    }

    builder.build()
}

fn file_display_name(path: &str) -> String {
    let name = Path::new(path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(path);

    if path == name {
        name.to_string()
    } else {
        format!("{name} — {path}")
    }
}
