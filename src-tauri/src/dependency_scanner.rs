use serde::{Serialize, Deserialize};
use std::path::Path;
use std::collections::HashSet;
use regex::Regex;
use crate::scanner::FiveMResource;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DependencyInfo {
    pub name: String,
    pub is_optional: bool,
    pub is_missing_locally: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DependencyScanReport {
    pub resource_name: String,
    pub path: String,
    pub declared_dependencies: Vec<DependencyInfo>,
    pub legacy_warnings: Vec<String>,
}

pub struct DependencyScanner;

impl DependencyScanner {
    pub fn scan(resource: &FiveMResource, server_root: Option<&str>) -> DependencyScanReport {
        let mut declared_dependencies = Vec::new();
        let mut legacy_warnings = Vec::new();

        if resource.manifest_type == "resource" {
            legacy_warnings.push("Resource uses legacy __resource.lua format. Modern dependency systems require fxmanifest.lua.".to_string());
        }

        let content = &resource.manifest_content;

        // Matches lines: dependency 'name' or dependency "name" or dependencies { 'name1', 'name2' }
        let dep_re = Regex::new(r#"(?i)dependenc(?:y|ies)\s+['"]([^'"]+)['"]"#).unwrap();
        for cap in dep_re.captures_iter(content) {
            let dep_name = cap[1].trim().to_string();
            if !dep_name.is_empty() {
                declared_dependencies.push(DependencyInfo {
                    name: dep_name,
                    is_optional: false,
                    is_missing_locally: false,
                });
            }
        }

        // Check block syntax like:
        // dependencies {
        //   'mysql-async',
        //   'essentialmode'
        // }
        let block_re = Regex::new(r#"(?s)(?i)dependencies\s*\{\s*([^}]+)\s*}"#).unwrap();
        if let Some(caps) = block_re.captures(content) {
            let inner = &caps[1];
            let item_re = Regex::new(r#"['"]([^'"]+)['"]"#).unwrap();
            for cap in item_re.captures_iter(inner) {
                let dep_name = cap[1].trim().to_string();
                if !dep_name.is_empty() && !declared_dependencies.iter().any(|d| d.name == dep_name) {
                    declared_dependencies.push(DependencyInfo {
                        name: dep_name,
                        is_optional: false,
                        is_missing_locally: false,
                    });
                }
            }
        }

        // Check if server root is specified, to verify if these directories actually exist locally
        if let Some(root_path) = server_root {
            let root = Path::new(root_path);
            if root.exists() && root.is_dir() {
                // Collect all folders in server resources directory recursively (up to 4 levels deep)
                let mut local_resources = HashSet::new();
                for entry in walkdir::WalkDir::new(root)
                    .max_depth(4)
                    .into_iter()
                    .filter_map(|e| e.ok())
                {
                    if entry.path().is_dir() {
                        if entry.path().join("fxmanifest.lua").exists() || entry.path().join("__resource.lua").exists() {
                            if let Some(folder_name) = entry.path().file_name().and_then(|n| n.to_str()) {
                                local_resources.insert(folder_name.to_lowercase());
                            }
                        }
                    }
                }

                // Update is_missing_locally status
                for dep in &mut declared_dependencies {
                    let dep_lower = dep.name.to_lowercase();
                    dep.is_missing_locally = !local_resources.contains(&dep_lower);
                }
            }
        }

        DependencyScanReport {
            resource_name: resource.name.clone(),
            path: resource.path.clone(),
            declared_dependencies,
            legacy_warnings,
        }
    }
}
