use std::sync::Mutex;

use serde::Serialize;
use tauri::{Emitter, Manager};

mod build;
mod images;
mod repository;

#[cfg(any(windows, target_os = "linux"))]
use tauri_plugin_deep_link::DeepLinkExt as _;

/// Event emitted when the app must open a repository (deep link or `--repo` argument).
const OPEN_REPOSITORY_EVENT: &str = "assets-pipeline://open-repository";
const MAIN_WINDOW: &str = "main";

#[derive(Clone, Serialize)]
pub struct OpenRepositoryPayload {
    repo: Option<String>,
}

#[derive(Default)]
struct PendingOpen(Mutex<Option<OpenRepositoryPayload>>);

fn payload_from_url(url: &tauri::Url) -> Option<OpenRepositoryPayload> {
    if url.scheme() != "assets-pipeline" {
        return None;
    }
    let repo = url
        .query_pairs()
        .find(|(key, _)| key == "repo")
        .map(|(_, value)| value.into_owned());
    Some(OpenRepositoryPayload { repo })
}

fn payload_from_args(args: &[String]) -> Option<OpenRepositoryPayload> {
    let mut repo = None;
    let mut found = false;
    let mut iter = args.iter().skip(1);
    while let Some(arg) = iter.next() {
        if arg == "--repo" {
            if let Some(value) = iter.next() {
                repo = Some(value.clone());
                found = true;
            }
        } else if arg.starts_with("assets-pipeline://") {
            if let Ok(url) = tauri::Url::parse(arg) {
                repo = url
                    .query_pairs()
                    .find(|(key, _)| key == "repo")
                    .map(|(_, value)| value.into_owned());
                found = true;
            }
        }
    }
    if found {
        Some(OpenRepositoryPayload { repo })
    } else {
        None
    }
}

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Returns the repository the CLI asked to open and clears it. The frontend pulls
/// this on startup to avoid racing the deep link event.
#[tauri::command]
fn take_pending_open(state: tauri::State<'_, PendingOpen>) -> Option<OpenRepositoryPayload> {
    state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            focus_main_window(app);
            if let Some(payload) = payload_from_args(&args) {
                let _ = app.emit(OPEN_REPOSITORY_EVENT, payload);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(PendingOpen::default())
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                if let Err(error) = app.deep_link().register_all() {
                    eprintln!("no se pudo registrar el esquema assets-pipeline://: {error}");
                }
            }

            let args: Vec<String> = std::env::args().collect();
            if let Some(payload) = payload_from_args(&args) {
                *app.state::<PendingOpen>().0.lock().unwrap() = Some(payload);
            }

            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    if let Some(payload) = payload_from_url(&url) {
                        let _ = handle.emit(OPEN_REPOSITORY_EVENT, payload);
                    }
                }
            });

            if let Ok(Some(urls)) = app.deep_link().get_current() {
                for url in urls {
                    if let Some(payload) = payload_from_url(&url) {
                        *app.state::<PendingOpen>().0.lock().unwrap() = Some(payload);
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            take_pending_open,
            repository::canonicalize,
            repository::is_real_directory,
            repository::find_repository,
            repository::read_database,
            repository::write_database,
            repository::list_entries,
            repository::path_kind,
            repository::make_directory,
            repository::move_path,
            repository::stage_removal,
            repository::commit_removal,
            repository::rollback_removal,
            repository::read_file_head,
            repository::acquire_lock,
            repository::release_lock,
            images::render_source,
            build::build_atlases,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Assets Pipeline");
}
