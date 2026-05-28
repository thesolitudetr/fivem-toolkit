use serde::{Serialize, Deserialize};
use std::fs;
use std::path::Path;
use std::collections::HashSet;
use regex::Regex;
use crate::errors::DextaError;
use crate::scanner::FiveMResource;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MetaIssue {
    pub id: String,
    pub issue_type: String, // "missing_manifest" | "legacy_manifest" | "missing_file_reference" | "unregistered_meta" | "malformed_xml"
    pub file_name: String,
    pub relative_path: String,
    pub severity: String, // "warning" | "critical"
    pub description: String,
    pub proposed_fix: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ValidationResult {
    pub path: String,
    pub is_valid: bool,
    pub issues: Vec<MetaIssue>,
}

pub struct MetaFixer;

impl MetaFixer {
    pub fn validate(resource: &FiveMResource) -> ValidationResult {
        let mut issues = Vec::new();
        let resource_path = Path::new(&resource.path);

        // 1. Missing or legacy manifest check
        if !resource.has_manifest {
            issues.push(MetaIssue {
                id: "missing_manifest".to_string(),
                issue_type: "missing_manifest".to_string(),
                file_name: "".to_string(),
                relative_path: "".to_string(),
                severity: "critical".to_string(),
                description: "This resource does not contain an fxmanifest.lua or __resource.lua file.".to_string(),
                proposed_fix: "Create a standard fxmanifest.lua with fx_version 'cerulean'.".to_string(),
            });
        } else if resource.manifest_type == "resource" {
            issues.push(MetaIssue {
                id: "legacy_manifest".to_string(),
                issue_type: "legacy_manifest".to_string(),
                file_name: "__resource.lua".to_string(),
                relative_path: "__resource.lua".to_string(),
                severity: "warning".to_string(),
                description: "This resource uses a legacy __resource.lua manifest.".to_string(),
                proposed_fix: "Convert __resource.lua to fxmanifest.lua (recommended for modern FiveM builds).".to_string(),
            });
        }

        // 2. Parse declared files in manifest
        let manifest_content = &resource.manifest_content;
        let mut declared_files = HashSet::new();

        // Regex to extract single quoted or double quoted paths like 'data/vehicles.meta' or "stream/car.yft"
        let file_re = Regex::new(r#"['"]([^'"]+\.[a-zA-Z0-9]+)['"]"#).unwrap();
        for cap in file_re.captures_iter(manifest_content) {
            let decl = cap[1].to_string().replace('\\', "/");
            declared_files.insert(decl);
        }

        // 3. Find files on disk vs manifest declarations
        for file in &resource.files {
            // Check if meta or stream or lua file is declared in the manifest
            let is_meta = file.relative_path.ends_with(".meta") || file.relative_path.ends_with(".xml");
            let is_lua = file.relative_path.ends_with(".lua") && file.name != "fxmanifest.lua" && file.name != "__resource.lua";
            
            // Check if this file is mentioned in manifest
            if (is_meta || is_lua) && !file.relative_path.to_lowercase().starts_with("stream/") {
                let found = declared_files.contains(&file.relative_path) 
                    || declared_files.contains(&format!("./{}", file.relative_path));
                
                if !found {
                    issues.push(MetaIssue {
                        id: format!("unregistered_{}", file.name),
                        issue_type: "unregistered_meta".to_string(),
                        file_name: file.name.clone(),
                        relative_path: file.relative_path.clone(),
                        severity: "warning".to_string(),
                        description: format!("File '{}' exists on disk but is not registered in manifest.", file.relative_path),
                        proposed_fix: format!("Add '{}' to the files {{}} section and register its data_file entry.", file.relative_path),
                    });
                }
            }

            // 4. Check for malformed XML
            if is_meta {
                let full_path = resource_path.join(&file.relative_path);
                if let Ok(xml_content) = fs::read_to_string(full_path) {
                    // Try parsing with quick-xml Reader to find errors
                    let mut reader = quick_xml::Reader::from_str(&xml_content);
                    reader.config_mut().check_comments = true;
                    let mut buf = Vec::new();
                    let mut is_malformed = false;
                    let mut err_msg = String::new();

                    loop {
                        match reader.read_event_into(&mut buf) {
                            Ok(quick_xml::events::Event::Eof) => break,
                            Err(e) => {
                                is_malformed = true;
                                err_msg = e.to_string();
                                break;
                            }
                            _ => {}
                        }
                        buf.clear();
                    }

                    if is_malformed {
                        issues.push(MetaIssue {
                            id: format!("malformed_xml_{}", file.name),
                            issue_type: "malformed_xml".to_string(),
                            file_name: file.name.clone(),
                            relative_path: file.relative_path.clone(),
                            severity: "critical".to_string(),
                            description: format!("XML syntax error in '{}': {}", file.relative_path, err_msg),
                            proposed_fix: "Check XML structure, balance tag endings, and remove invalid syntax.".to_string(),
                        });
                    }
                }
            }
        }

        // 5. Check if files declared in manifest exist on disk
        for declared in declared_files {
            // Ignore wildcard folder paths like 'stream/*'
            if declared.contains('*') {
                continue;
            }

            let file_on_disk = resource.files.iter().any(|f| f.relative_path == declared);
            if !file_on_disk {
                issues.push(MetaIssue {
                    id: format!("missing_file_{}", declared.replace('/', "_")),
                    issue_type: "missing_file_reference".to_string(),
                    file_name: Path::new(&declared).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                    relative_path: declared.clone(),
                    severity: "warning".to_string(),
                    description: format!("Manifest references file '{}' but it is missing on disk.", declared),
                    proposed_fix: "Remove the path from fxmanifest.lua or restore the missing file to the folder.".to_string(),
                });
            }
        }

        let is_valid = issues.is_empty();

        ValidationResult {
            path: resource.path.clone(),
            is_valid,
            issues,
        }
    }

    pub fn fix_manifest(
        resource: &FiveMResource,
        output_dir: &str,
        in_place: bool,
    ) -> Result<String, DextaError> {
        let original_path = Path::new(&resource.path);
        
        let target_path = if in_place {
            original_path.to_path_buf()
        } else {
            let out_p = Path::new(output_dir).join(format!("{}_fixed", resource.name));
            // copy all files to new folder
            fs::create_dir_all(&out_p)?;
            for file in &resource.files {
                let src = original_path.join(&file.relative_path);
                let dest = out_p.join(&file.relative_path);
                if let Some(parent) = dest.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::copy(src, dest)?;
            }
            out_p
        };

        // Re-analyze unregistered files to append them to the fxmanifest
        let validation = Self::validate(resource);
        let unregistered_metas: Vec<String> = validation.issues.iter()
            .filter(|issue| issue.issue_type == "unregistered_meta")
            .map(|issue| issue.relative_path.clone())
            .collect();

        let mut manifest_content = if resource.manifest_type == "none" {
            "fx_version 'cerulean'\ngame 'gta5'\n\n".to_string()
        } else {
            resource.manifest_content.clone()
        };

        // Convert legacy __resource to fxmanifest if applicable
        if resource.manifest_type == "resource" {
            // Delete __resource.lua in target
            let old_manifest = target_path.join("__resource.lua");
            if old_manifest.exists() {
                fs::remove_file(old_manifest)?;
            }
            // prepend fx_version
            manifest_content = format!("fx_version 'cerulean'\ngame 'gta5'\n\n{}", manifest_content);
        }

        // Append unregistered meta files
        if !unregistered_metas.is_empty() {
            let mut file_decls = "\nfiles {\n".to_string();
            let mut data_decls = "\n".to_string();

            for meta in &unregistered_metas {
                file_decls.push_str(&format!("  '{}',\n", meta));
                let name_lower = meta.to_lowercase();
                if name_lower.contains("vehicles.meta") {
                    data_decls.push_str(&format!("data_file 'VEHICLE_METADATA_FILE' '{}'\n", meta));
                } else if name_lower.contains("handling.meta") {
                    data_decls.push_str(&format!("data_file 'HANDLING_FILE' '{}'\n", meta));
                } else if name_lower.contains("carvariations.meta") {
                    data_decls.push_str(&format!("data_file 'VEHICLE_VARIATION_FILE' '{}'\n", meta));
                } else if name_lower.contains("carcols.meta") {
                    data_decls.push_str(&format!("data_file 'CARCOLS_FILE' '{}'\n", meta));
                } else if name_lower.contains("vehiclelayouts.meta") {
                    data_decls.push_str(&format!("data_file 'VEHICLE_LAYOUTS_FILE' '{}'\n", meta));
                }
            }

            file_decls.push_str("}\n");
            manifest_content.push_str(&file_decls);
            manifest_content.push_str(&data_decls);
        }

        let new_manifest_path = target_path.join("fxmanifest.lua");
        fs::write(new_manifest_path, manifest_content)?;

        Ok(target_path.to_string_lossy().to_string().replace('\\', "/"))
    }
}
