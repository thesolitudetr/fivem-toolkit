use tauri::State;
use std::sync::Mutex;
use std::path::Path;
use crate::errors::DextaError;
use crate::scanner::{FiveMResource, ResourceDetector};
use crate::stream_analyzer::{StreamAnalyzer, StreamAnalysisReport};
use crate::vehicle_merger::{VehicleMerger, MergePreview, MergeReport};
use crate::meta_fixer::{MetaFixer, ValidationResult};
use crate::dependency_scanner::{DependencyScanner, DependencyScanReport};
use crate::exporter::{Exporter, ExportResult};
use crate::storage::{StorageManager, DextaDb, RecentActivity, RecentProject};

pub struct AppState {
    pub storage: Mutex<StorageManager>,
}

#[tauri::command]
pub fn load_settings(state: State<'_, AppState>) -> Result<DextaDb, DextaError> {
    let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
    storage.load()
}

#[tauri::command]
pub fn save_settings(state: State<'_, AppState>, db: DextaDb) -> Result<(), DextaError> {
    let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
    storage.save(&db)
}

#[tauri::command]
pub fn scan_resource(path: String) -> Result<FiveMResource, DextaError> {
    ResourceDetector::scan_resource(path)
}

#[tauri::command]
pub fn scan_collection(path: String) -> Result<Vec<FiveMResource>, DextaError> {
    ResourceDetector::scan_collection(path)
}

#[tauri::command]
pub fn analyze_stream(state: State<'_, AppState>, resource_path: String) -> Result<StreamAnalysisReport, DextaError> {
    let resource = ResourceDetector::scan_resource(&resource_path)?;
    let db = {
        let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
        storage.load()?
    };
    
    let report = StreamAnalyzer::analyze(&resource, &db.settings.thresholds);

    // Save recent activity
    let mut updated_db = db.clone();
    updated_db.recent_activity.insert(0, RecentActivity {
        id: uuid::Uuid::new_v4().to_string(),
        activity_type: "scan".to_string(),
        resource_name: resource.name.clone(),
        path: resource_path.clone(),
        timestamp: chrono::Local::now().to_rfc3339(),
        message: format!("Stream analysis completed for {}", resource.name),
    });
    
    // Add to recent projects
    if !updated_db.recent_projects.iter().any(|p| p.path == resource.path) {
        updated_db.recent_projects.push(RecentProject {
            name: resource.name.clone(),
            path: resource.path.clone(),
            resource_count: 1,
            total_size: resource.total_size,
            last_opened: chrono::Local::now().to_rfc3339(),
        });
    }

    let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
    storage.save(&updated_db)?;

    Ok(report)
}

#[tauri::command]
pub fn preview_merge(resource_paths: Vec<String>) -> Result<MergePreview, DextaError> {
    let mut resources = Vec::new();
    for path in resource_paths {
        resources.push(ResourceDetector::scan_resource(path)?);
    }
    Ok(VehicleMerger::analyze_for_merge(&resources))
}

#[tauri::command]
pub fn execute_merge(
    state: State<'_, AppState>,
    resource_paths: Vec<String>,
    output_name: String,
    output_dir: String,
) -> Result<MergeReport, DextaError> {
    let mut resources = Vec::new();
    for path in &resource_paths {
        resources.push(ResourceDetector::scan_resource(path)?);
    }
    let report = VehicleMerger::execute_merge(&resources, &output_name, &output_dir)?;

    // Save activity
    let db = {
        let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
        storage.load()?
    };
    let mut updated_db = db.clone();
    updated_db.recent_activity.insert(0, RecentActivity {
        id: uuid::Uuid::new_v4().to_string(),
        activity_type: "merge".to_string(),
        resource_name: output_name.clone(),
        path: format!("{}/{}", output_dir, output_name).replace('\\', "/"),
        timestamp: chrono::Local::now().to_rfc3339(),
        message: format!("Merged pack '{}' exported", output_name),
    });

    let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
    storage.save(&updated_db)?;

    Ok(report)
}

#[tauri::command]
pub fn validate_resource(resource_path: String) -> Result<ValidationResult, DextaError> {
    let resource = ResourceDetector::scan_resource(resource_path)?;
    Ok(MetaFixer::validate(&resource))
}

#[tauri::command]
pub fn fix_resource(
    state: State<'_, AppState>,
    resource_path: String,
    output_dir: String,
    in_place: bool,
) -> Result<String, DextaError> {
    let resource = ResourceDetector::scan_resource(&resource_path)?;
    let fixed_path = MetaFixer::fix_manifest(&resource, &output_dir, in_place)?;

    // Save activity
    let db = {
        let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
        storage.load()?
    };
    let mut updated_db = db.clone();
    updated_db.recent_activity.insert(0, RecentActivity {
        id: uuid::Uuid::new_v4().to_string(),
        activity_type: "fix".to_string(),
        resource_name: resource.name.clone(),
        path: fixed_path.clone(),
        timestamp: chrono::Local::now().to_rfc3339(),
        message: format!("Meta fixer completed for {}", resource.name),
    });

    let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
    storage.save(&updated_db)?;

    Ok(fixed_path)
}

#[tauri::command]
pub fn scan_dependencies(resource_path: String, server_root: Option<String>) -> Result<DependencyScanReport, DextaError> {
    let resource = ResourceDetector::scan_resource(resource_path)?;
    Ok(DependencyScanner::scan(&resource, server_root.as_deref()))
}

#[tauri::command]
pub fn export_build(
    state: State<'_, AppState>,
    src_dir: String,
    dest_dir: String,
    as_zip: bool,
) -> Result<ExportResult, DextaError> {
    let result = Exporter::export(&src_dir, &dest_dir, as_zip)?;

    // Save activity
    let db = {
        let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
        storage.load()?
    };
    let mut updated_db = db.clone();
    let res_name = Path::new(&src_dir).file_name().and_then(|n| n.to_str()).unwrap_or("resource").to_string();
    
    updated_db.recent_activity.insert(0, RecentActivity {
        id: uuid::Uuid::new_v4().to_string(),
        activity_type: "export".to_string(),
        resource_name: res_name,
        path: result.output_path.clone(),
        timestamp: chrono::Local::now().to_rfc3339(),
        message: format!("Build exported to {}", result.output_path),
    });

    let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
    storage.save(&updated_db)?;

    Ok(result)
}

#[tauri::command]
pub fn export_analysis_report(
    report: StreamAnalysisReport,
    export_path: String,
    format_type: String,
) -> Result<(), DextaError> {
    StreamAnalyzer::export_report(&report, &export_path, &format_type)
}

#[tauri::command]
pub fn clear_history(state: State<'_, AppState>) -> Result<(), DextaError> {
    let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
    let mut db = storage.load()?;
    db.recent_activity.clear();
    db.recent_projects.clear();
    storage.save(&db)
}

#[tauri::command]
pub fn open_app_data_path(state: State<'_, AppState>) -> Result<String, DextaError> {
    let storage = state.storage.lock().map_err(|e| DextaError::Other(e.to_string()))?;
    Ok(storage.get_db_path())
}
