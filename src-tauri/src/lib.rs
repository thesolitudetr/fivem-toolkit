pub mod errors;
pub mod storage;
pub mod scanner;
pub mod stream_analyzer;
pub mod vehicle_merger;
pub mod vehicle_extractor;
pub mod vehicle_editor;
pub mod ytd_parser;
pub mod meta_fixer;
pub mod dependency_scanner;
pub mod exporter;
pub mod commands;

use std::sync::Mutex;
use crate::commands::AppState;
use crate::storage::StorageManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let storage_manager = StorageManager::new();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            storage: Mutex::new(storage_manager),
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_settings,
            commands::save_settings,
            commands::scan_resource,
            commands::scan_collection,
            commands::analyze_stream,
            commands::preview_merge,
            commands::execute_merge,
            commands::validate_resource,
            commands::fix_resource,
            commands::scan_dependencies,
            commands::export_build,
            commands::export_analysis_report,
            commands::clear_history,
            commands::open_app_data_path,
            commands::read_text_file,
            commands::optimize_textures,
            commands::extract_vehicle,
            commands::get_ytd_textures,
            commands::load_vehicle_editor_configs,
            commands::save_vehicle_editor_configs,
            commands::scan_server_resources,
            commands::bulk_fix_resources,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
