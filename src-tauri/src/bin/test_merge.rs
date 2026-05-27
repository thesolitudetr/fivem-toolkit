use std::fs;
use tauri_app_lib::scanner::ResourceDetector;
use tauri_app_lib::vehicle_merger::VehicleMerger;

fn main() {
    let input_dir = "C:\\Users\\glens\\Desktop\\araclar";
    let output_parent = "C:\\Users\\glens\\Desktop";
    let output_name = "araclar_merged";

    println!("Scanning folders inside {}...", input_dir);

    let entries = match fs::read_dir(input_dir) {
        Ok(e) => e,
        Err(err) => {
            eprintln!("Failed to read directory {}: {}", input_dir, err);
            return;
        }
    };

    let mut resource_paths = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_dir() {
                resource_paths.push(path.to_string_lossy().to_string());
            }
        }
    }

    if resource_paths.is_empty() {
        println!("No subdirectories found inside {}", input_dir);
        return;
    }

    println!("Found {} vehicle resource folders to merge.", resource_paths.len());

    let mut resources = Vec::new();
    for path in &resource_paths {
        println!("Scanning resource: {}", path);
        match ResourceDetector::scan_resource(path.clone()) {
            Ok(res) => resources.push(res),
            Err(err) => {
                eprintln!("Error scanning {}: {:?}", path, err);
                return;
            }
        }
    }

    println!("Running merge preview / conflict check...");
    let preview = VehicleMerger::analyze_for_merge(&resources);
    println!("--- Conflict Check Summary ---");
    println!("Can Merge: {}", preview.can_merge);
    println!("Duplicate stream files found: {}", preview.stream_conflicts.len());
    for conflict in &preview.stream_conflicts {
        println!("  [Conflict] {}", conflict);
    }
    println!("Duplicate spawn codes (models) found: {}", preview.model_conflicts.len());
    for conflict in &preview.model_conflicts {
        println!("  [Conflict] {}", conflict);
    }
    println!("Duplicate handling IDs found: {}", preview.handling_conflicts.len());
    for conflict in &preview.handling_conflicts {
        println!("  [Conflict] {}", conflict);
    }

    println!("\nExecuting merge...");
    match VehicleMerger::execute_merge(&resources, output_name, output_parent) {
        Ok(report) => {
            println!("--- Merge Execution Successful ---");
            println!("Timestamp: {}", report.timestamp);
            println!("Output Pack Name: {}", report.output_name);
            println!("Source Resources Merged: {:?}", report.source_resources);
            println!("Total Copied Stream Files: {}", report.copied_stream_files.len());
            println!("Merged Metadata Files: {:?}", report.merged_meta_files);
            println!("Total Warnings: {}", report.warnings.len());
            for warning in &report.warnings {
                println!("  [Warning] {}", warning);
            }
            println!("Merged pack compiled successfully to: {}\\{}", output_parent, output_name);
        }
        Err(err) => {
            eprintln!("Merge execution failed: {:?}", err);
        }
    }
}
