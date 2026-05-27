use std::fs;
use std::path::{Path, PathBuf};
use tauri_app_lib::scanner::{ResourceDetector, FiveMResource};
use tauri_app_lib::stream_analyzer::StreamAnalyzer;
use tauri_app_lib::vehicle_merger::VehicleMerger;
use tauri_app_lib::meta_fixer::MetaFixer;
use tauri_app_lib::dependency_scanner::DependencyScanner;
use tauri_app_lib::exporter::Exporter;
use tauri_app_lib::storage::Thresholds;

fn setup_temp_workspace() -> PathBuf {
    let mut temp = std::env::temp_dir();
    temp.push(format!("dexta_test_{}", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("run")));
    let _ = fs::create_dir_all(&temp);
    temp
}

#[test]
fn test_resource_scanning_and_classification() {
    let ws = setup_temp_workspace();
    let res_dir = ws.join("test_vehicle");
    fs::create_dir_all(&res_dir).unwrap();
    fs::create_dir_all(res_dir.join("stream")).unwrap();
    fs::create_dir_all(res_dir.join("data")).unwrap();

    // Create manifest
    fs::write(res_dir.join("fxmanifest.lua"), "fx_version 'cerulean'\ngame 'gta5'\n").unwrap();
    
    // Create stream assets
    fs::write(res_dir.join("stream/audi.yft"), vec![0; 500]).unwrap();
    fs::write(res_dir.join("stream/audi.ytd"), vec![0; 1000]).unwrap();
    
    // Create meta data
    fs::write(res_dir.join("data/vehicles.meta"), "<modelName>audi</modelName>").unwrap();

    let scanned = ResourceDetector::scan_resource(&res_dir).unwrap();
    assert_eq!(scanned.name, "test_vehicle");
    assert!(scanned.has_manifest);
    assert_eq!(scanned.manifest_type, "fxmanifest");
    assert_eq!(scanned.files.len(), 4); // fxmanifest, audi.yft, audi.ytd, vehicles.meta

    let yft_file = scanned.files.iter().find(|f| f.category == "yft").unwrap();
    assert_eq!(yft_file.name, "audi.yft");
    assert_eq!(yft_file.size, 500);

    let ytd_file = scanned.files.iter().find(|f| f.category == "ytd").unwrap();
    assert_eq!(ytd_file.name, "audi.ytd");
    assert_eq!(ytd_file.size, 1000);

    let _ = fs::remove_dir_all(&ws);
}

#[test]
fn test_stream_analyzer_warnings() {
    let ws = setup_temp_workspace();
    let res_dir = ws.join("heavy_vehicle");
    fs::create_dir_all(&res_dir).unwrap();
    fs::create_dir_all(res_dir.join("stream")).unwrap();

    fs::write(res_dir.join("fxmanifest.lua"), "fx_version 'cerulean'\n").unwrap();
    fs::write(res_dir.join("stream/heavy.ytd"), vec![0; 20 * 1024 * 1024]).unwrap(); // 20MB file (exceeds default 16MB)

    let scanned = ResourceDetector::scan_resource(&res_dir).unwrap();
    let thresholds = Thresholds {
        large_ytd: 16 * 1024 * 1024,
        large_yft: 16 * 1024 * 1024,
        large_awc: 15 * 1024 * 1024,
        overall_resource: 100 * 1024 * 1024,
    };

    let report = StreamAnalyzer::analyze(&scanned, &thresholds);
    assert_eq!(report.warnings.len(), 1);
    assert_eq!(report.warnings[0].severity, "warning");
    assert!(report.warnings[0].file_name.contains("heavy.ytd"));

    let _ = fs::remove_dir_all(&ws);
}

#[test]
fn test_vehicle_merge_and_conflict_detection() {
    let ws = setup_temp_workspace();
    
    // Create addon 1
    let add1 = ws.join("addon1");
    fs::create_dir_all(&add1).unwrap();
    fs::create_dir_all(add1.join("stream")).unwrap();
    fs::write(add1.join("fxmanifest.lua"), "").unwrap();
    fs::write(add1.join("stream/car1.yft"), "yft1").unwrap();
    fs::write(add1.join("vehicles.meta"), "<modelName>car1</modelName>\n<handlingId>HAND_CAR1</handlingId>").unwrap();

    // Create addon 2 (no conflicts)
    let add2 = ws.join("addon2");
    fs::create_dir_all(&add2).unwrap();
    fs::create_dir_all(add2.join("stream")).unwrap();
    fs::write(add2.join("fxmanifest.lua"), "").unwrap();
    fs::write(add2.join("stream/car2.yft"), "yft2").unwrap();
    fs::write(add2.join("vehicles.meta"), "<modelName>car2</modelName>\n<handlingId>HAND_CAR2</handlingId>").unwrap();

    let res1 = ResourceDetector::scan_resource(&add1).unwrap();
    let res2 = ResourceDetector::scan_resource(&add2).unwrap();

    let preview = VehicleMerger::analyze_for_merge(&[res1.clone(), res2.clone()]);
    assert!(preview.can_merge);
    assert_eq!(preview.stream_conflicts.len(), 0);
    assert_eq!(preview.model_conflicts.len(), 0);

    // Merge them
    let output_name = "merged_pack";
    let report = VehicleMerger::execute_merge(&[res1, res2], output_name, ws.to_str().unwrap()).unwrap();
    assert_eq!(report.output_name, "merged_pack");
    assert_eq!(report.source_resources.len(), 2);
    
    let merged_dir = ws.join("merged_pack");
    assert!(merged_dir.exists());
    assert!(merged_dir.join("stream/car1.yft").exists());
    assert!(merged_dir.join("stream/car2.yft").exists());
    assert!(merged_dir.join("fxmanifest.lua").exists());
    assert!(merged_dir.join("dexta_manifest.json").exists());

    let _ = fs::remove_dir_all(&ws);
}

#[test]
fn test_meta_fixer_diagnostics() {
    let ws = setup_temp_workspace();
    let res_dir = ws.join("broken_resource");
    fs::create_dir_all(&res_dir).unwrap();
    
    // No manifest at all!
    fs::write(res_dir.join("vehicles.meta"), "<CVehicleModelInfo__InitDataList></CVehicleModelInfo__InitDataList>").unwrap();

    let scanned = ResourceDetector::scan_resource(&res_dir).unwrap();
    let validation = MetaFixer::validate(&scanned);
    assert!(!validation.is_valid);
    
    // Should flag missing manifest and unregistered vehicles.meta
    assert!(validation.issues.iter().any(|i| i.issue_type == "missing_manifest"));
    assert!(validation.issues.iter().any(|i| i.issue_type == "unregistered_meta"));

    let _ = fs::remove_dir_all(&ws);
}
