use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use regex::Regex;

use crate::errors::DextaError;
use crate::scanner::FiveMResource;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergeVehicleInfo {
    pub name: String,
    pub model_names: Vec<String>,
    pub handling_ids: Vec<String>,
    pub stream_files: Vec<String>,
    pub meta_files: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergePreview {
    pub vehicles: Vec<MergeVehicleInfo>,
    pub stream_conflicts: Vec<String>,
    pub model_conflicts: Vec<String>,
    pub handling_conflicts: Vec<String>,
    pub can_merge: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MergeReport {
    pub timestamp: String,
    pub output_name: String,
    pub source_resources: Vec<String>,
    pub copied_stream_files: Vec<String>,
    pub merged_meta_files: Vec<String>,
    pub warnings: Vec<String>,
}

pub struct VehicleMerger;

impl VehicleMerger {
    // Statically extract tags like <modelName>...</modelName> using regex for robustness
    pub fn extract_xml_tags(content: &str, tag: &str) -> Vec<String> {
        let re = Regex::new(&format!(r#"<{}>\s*([^<\s]+)\s*</{}>"#, tag, tag)).unwrap();
        re.captures_iter(content)
            .map(|cap| cap[1].to_string())
            .collect()
    }

    pub fn analyze_for_merge(resources: &[FiveMResource]) -> MergePreview {
        let mut vehicles = Vec::new();
        let mut all_stream_files: HashMap<String, Vec<String>> = HashMap::new(); // file_name -> list of resource_names
        let mut all_models: HashMap<String, Vec<String>> = HashMap::new(); // model_name -> list of resource_names
        let mut all_handlings: HashMap<String, Vec<String>> = HashMap::new(); // handling_id -> list of resource_names

        for res in resources {
            let mut model_names = Vec::new();
            let mut handling_ids = Vec::new();
            let mut stream_files = Vec::new();
            let mut meta_files = Vec::new();
            let mut warnings = Vec::new();

            // 1. Identify stream files & metadata files
            for file in &res.files {
                if file.relative_path.to_lowercase().starts_with("stream/") {
                    stream_files.push(file.name.clone());
                    all_stream_files.entry(file.name.clone())
                        .or_default()
                        .push(res.name.clone());
                } else if file.relative_path.ends_with(".meta") {
                    meta_files.push(file.relative_path.clone());
                }
            }

            // 2. Read meta files content to extract modelNames and handlingIds
            for file in &res.files {
                if file.relative_path.ends_with(".meta") {
                    let full_path = Path::new(&res.path).join(&file.relative_path);
                    if let Ok(content) = fs::read_to_string(full_path) {
                        let models = Self::extract_xml_tags(&content, "modelName");
                        let handlings = Self::extract_xml_tags(&content, "handlingId");

                        // Also look for handlingName in handling.meta
                        let handlings_alt = Self::extract_xml_tags(&content, "handlingName");

                        for m in models {
                            let m_lower = m.to_lowercase();
                            if !model_names.contains(&m_lower) {
                                model_names.push(m_lower.clone());
                                all_models.entry(m_lower)
                                    .or_default()
                                    .push(res.name.clone());
                            }
                        }

                        let combined_handlings = handlings.into_iter().chain(handlings_alt.into_iter());
                        for h in combined_handlings {
                            let h_lower = h.to_lowercase();
                            if !handling_ids.contains(&h_lower) {
                                handling_ids.push(h_lower.clone());
                                all_handlings.entry(h_lower)
                                    .or_default()
                                    .push(res.name.clone());
                            }
                        }
                    } else {
                        warnings.push(format!("Failed to read meta file: {}", file.relative_path));
                    }
                }
            }

            if model_names.is_empty() {
                warnings.push("No vehicle spawn codes (modelName) detected in metadata. Manual check required.".to_string());
            }

            vehicles.push(MergeVehicleInfo {
                name: res.name.clone(),
                model_names,
                handling_ids,
                stream_files,
                meta_files,
                warnings,
            });
        }

        let mut stream_conflicts = Vec::new();
        for (file, sources) in all_stream_files {
            if sources.len() > 1 {
                stream_conflicts.push(format!("File '{}' is present in resources: {:?}", file, sources));
            }
        }

        let mut model_conflicts = Vec::new();
        for (model, sources) in all_models {
            if sources.len() > 1 {
                model_conflicts.push(format!("Spawn code '{}' is used in resources: {:?}", model, sources));
            }
        }

        let mut handling_conflicts = Vec::new();
        for (handling, sources) in all_handlings {
            if sources.len() > 1 {
                handling_conflicts.push(format!("Handling ID '{}' is used in resources: {:?}", handling, sources));
            }
        }

        // We permit merge if there are no critical duplicate stream files or model conflicts
        let can_merge = stream_conflicts.is_empty() && model_conflicts.is_empty();

        MergePreview {
            vehicles,
            stream_conflicts,
            model_conflicts,
            handling_conflicts,
            can_merge,
        }
    }

    // Merges content list inside an XML structure. E.g. merges <Item> nodes from <InitDatas> tags
    pub fn merge_xml_files(files: &[PathBuf], target_root: &str, target_parent: &str) -> Result<String, DextaError> {
        let mut items = Vec::new();
        let mut header = String::new();

        let parent_start = format!("<{}>", target_parent);
        let parent_end = format!("</{}>", target_parent);

        for path in files {
            let content = fs::read_to_string(path)?;
            
            // Find parent block e.g., <InitDatas>...</InitDatas>
            if let Some(start_idx) = content.find(&parent_start) {
                if let Some(end_idx) = content.find(&parent_end) {
                    let block_content = &content[start_idx + parent_start.len() .. end_idx];
                    items.push(block_content.trim().to_string());
                }
            }

            // Capture XML declaration or comments from the first file
            if header.is_empty() {
                if let Some(root_start) = content.find(&format!("<{}", target_root)) {
                    header = content[..root_start].to_string();
                }
            }
        }

        if header.is_empty() {
            header = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".to_string();
        }

        let merged_items = items.join("\n      ");
        let merged_xml = format!(
            "{header}<{root}>\n  <{parent}>\n      {items}\n  </{parent}>\n</{root}>",
            header = header,
            root = target_root,
            parent = target_parent,
            items = merged_items
        );

        Ok(merged_xml)
    }

    /// Merges carcols.meta files: combines <Kits> and <Lights> sections from all sources.
    /// Root tag: CVehicleModelInfoVarGlobal (case-insensitive detection)
    pub fn merge_carcols_files(files: &[PathBuf]) -> Result<String, DextaError> {
        let mut kits_items = Vec::new();
        let mut lights_items = Vec::new();
        let mut header = String::new();

        for path in files {
            let content = fs::read_to_string(path)?;
            let content_lower = content.to_lowercase();
            
            if let Some(start_idx) = content_lower.find("<kits>") {
                if let Some(end_idx) = content_lower.find("</kits>") {
                    let block = &content[start_idx + "<kits>".len() .. end_idx];
                    let trimmed = block.trim();
                    if !trimmed.is_empty() {
                        kits_items.push(trimmed.to_string());
                    }
                }
            }

            if let Some(start_idx) = content_lower.find("<lights>") {
                if let Some(end_idx) = content_lower.find("</lights>") {
                    let block = &content[start_idx + "<lights>".len() .. end_idx];
                    let trimmed = block.trim();
                    if !trimmed.is_empty() {
                        lights_items.push(trimmed.to_string());
                    }
                }
            }

            if header.is_empty() {
                if let Some(root_start) = content_lower.find("<cvehiclemodelinfovar") {
                    header = content[..root_start].to_string();
                }
            }
        }

        if header.is_empty() {
            header = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".to_string();
        }

        let merged_kits = kits_items.join("\n      ");
        let merged_lights = lights_items.join("\n      ");

        let merged_xml = format!(
            "{header}<CVehicleModelInfoVarGlobal>\n  <Kits>\n      {kits}\n  </Kits>\n  <Lights>\n      {lights}\n  </Lights>\n</CVehicleModelInfoVarGlobal>",
            header = header,
            kits = merged_kits,
            lights = merged_lights
        );

        Ok(merged_xml)
    }

    /// Merges vehiclelayouts.meta files: combines <Layouts> and <txdRelationships> sections.
    /// Root tag: CVehicleMetadataMgr
    pub fn merge_vehiclelayouts_files(files: &[PathBuf]) -> Result<String, DextaError> {
        let mut layout_items = Vec::new();
        let mut txd_items = Vec::new();
        let mut header = String::new();

        for path in files {
            let content = fs::read_to_string(path)?;
            let content_lower = content.to_lowercase();

            if let Some(start_idx) = content_lower.find("<layouts>") {
                if let Some(end_idx) = content_lower.find("</layouts>") {
                    let block = &content[start_idx + "<Layouts>".len() .. end_idx];
                    let trimmed = block.trim();
                    if !trimmed.is_empty() {
                        layout_items.push(trimmed.to_string());
                    }
                }
            }

            if let Some(start_idx) = content_lower.find("<txdrelationships>") {
                if let Some(end_idx) = content_lower.find("</txdrelationships>") {
                    let block = &content[start_idx + "<txdRelationships>".len() .. end_idx];
                    let trimmed = block.trim();
                    if !trimmed.is_empty() {
                        txd_items.push(trimmed.to_string());
                    }
                }
            }

            if header.is_empty() {
                if let Some(root_start) = content_lower.find("<cvehiclemetadatamgr") {
                    header = content[..root_start].to_string();
                }
            }
        }

        if header.is_empty() {
            header = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".to_string();
        }

        let merged_layouts = layout_items.join("\n      ");
        let merged_txd = txd_items.join("\n      ");

        let merged_xml = format!(
            "{header}<CVehicleMetadataMgr>\n  <txdRelationships>\n      {txd}\n  </txdRelationships>\n  <Layouts>\n      {layouts}\n  </Layouts>\n</CVehicleMetadataMgr>",
            header = header,
            txd = merged_txd,
            layouts = merged_layouts
        );

        Ok(merged_xml)
    }

    /// Auto-detect the root XML element tag from content.
    /// Skips XML declarations and comments, finds the first real element.
    pub fn detect_root_tag(content: &str) -> Option<String> {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("<?") || trimmed.starts_with("<!--") {
                continue;
            }
            if trimmed.starts_with('<') && !trimmed.starts_with("</") {
                // Extract tag name: <TagName ...> or <TagName>
                let tag_start = 1; // skip '<'
                let tag_end = trimmed[tag_start..]
                    .find(|c: char| c == '>' || c == ' ' || c == '/')
                    .unwrap_or(trimmed.len() - tag_start);
                let tag_name = &trimmed[tag_start..tag_start + tag_end];
                if !tag_name.is_empty() {
                    return Some(tag_name.to_string());
                }
            }
        }
        None
    }
    pub fn merge_root_items_xml(files: &[PathBuf], target_root: &str) -> Result<String, DextaError> {
        let mut items = Vec::new();
        let mut header = String::new();
        let root_lower = target_root.to_lowercase();

        for path in files {
            let content = fs::read_to_string(path)?;
            let content_lower = content.to_lowercase();
            
            let start_tag = format!("<{}", root_lower);
            if let Some(start_pos) = content_lower.find(&start_tag) {
                if let Some(tag_end_pos) = content[start_pos..].find('>') {
                    let start_idx = start_pos + tag_end_pos + 1;
                    let end_tag = format!("</{}>", root_lower);
                    if let Some(end_idx) = content_lower.find(&end_tag) {
                        let block_content = &content[start_idx..end_idx];
                        items.push(block_content.trim().to_string());
                    }
                }
            }

            if header.is_empty() {
                if let Some(r_start) = content_lower.find(&start_tag) {
                    header = content[..r_start].to_string();
                }
            }
        }

        if header.is_empty() {
            header = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".to_string();
        }

        let merged_items = items.join("\n  ");
        let merged_xml = format!(
            "{header}<{root}>\n  {items}\n</{root}>",
            header = header,
            root = target_root,
            items = merged_items
        );

        Ok(merged_xml)
    }

    pub fn execute_merge(
        resources: &[FiveMResource],
        output_name: &str,
        output_parent_dir: &str,
    ) -> Result<MergeReport, DextaError> {
        let output_parent_path = Path::new(output_parent_dir);
        let output_resource_path = output_parent_path.join(output_name);

        if !output_parent_path.exists() {
            return Err(DextaError::Validation("Output parent directory does not exist".to_string()));
        }

        // Staging directory
        let staging_name = format!("{}_staging_{}", output_name, uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("tmp"));
        let staging_path = output_parent_path.join(&staging_name);
        fs::create_dir_all(&staging_path)?;

        let stream_dest = staging_path.join("stream");
        let data_dest = staging_path.join("data");
        fs::create_dir_all(&stream_dest)?;
        fs::create_dir_all(&data_dest)?;

        let mut copied_stream_files = Vec::new();
        let mut warnings = Vec::new();
        let mut source_names = Vec::new();

        // 1. Copy stream files & collect meta files by category
        let mut meta_by_type: HashMap<String, Vec<PathBuf>> = HashMap::new();

        for res in resources {
            source_names.push(res.name.clone());
            for file in &res.files {
                let src_path = Path::new(&file.path);
                if file.relative_path.to_lowercase().starts_with("stream/") {
                    let dest_file = stream_dest.join(&file.name);
                    fs::copy(src_path, &dest_file)?;
                    copied_stream_files.push(file.name.clone());
                } else if file.relative_path.ends_with(".meta") {
                    let meta_name = file.name.to_lowercase();
                    meta_by_type.entry(meta_name)
                        .or_default()
                        .push(src_path.to_path_buf());
                }
            }
        }

        // 2. Merge meta files
        let mut merged_meta_files = Vec::new();
        for (meta_name, paths) in meta_by_type {
            let dest_meta_path = data_dest.join(&meta_name);
            if meta_name == "vehicles.meta" {
                if let Ok(xml) = Self::merge_xml_files(&paths, "CVehicleModelInfo__InitDataList", "InitDatas") {
                    fs::write(&dest_meta_path, xml)?;
                    merged_meta_files.push(meta_name);
                } else {
                    warnings.push("Failed merging vehicles.meta files structurally, skipped.".to_string());
                }
            } else if meta_name == "handling.meta" {
                if let Ok(xml) = Self::merge_xml_files(&paths, "CHandlingDataMgr", "HandlingData") {
                    fs::write(&dest_meta_path, xml)?;
                    merged_meta_files.push(meta_name);
                } else {
                    warnings.push("Failed merging handling.meta files structurally, skipped.".to_string());
                }
            } else if meta_name == "carvariations.meta" {
                if let Ok(xml) = Self::merge_xml_files(&paths, "CCarVariations", "variationData") {
                    fs::write(&dest_meta_path, xml)?;
                    merged_meta_files.push(meta_name);
                } else {
                    warnings.push("Failed merging carvariations.meta files structurally, skipped.".to_string());
                }
            } else if meta_name == "carcols.meta" {
                // carcols has <Kits> and <Lights> sections (siren/light configurations)
                if let Ok(xml) = Self::merge_carcols_files(&paths) {
                    fs::write(&dest_meta_path, xml)?;
                    merged_meta_files.push(meta_name);
                } else {
                    warnings.push("Failed merging carcols.meta files structurally, skipped.".to_string());
                }
            } else if meta_name == "vehiclelayouts.meta" {
                // vehiclelayouts has <Layouts> and <txdRelationships> sections
                if let Ok(xml) = Self::merge_vehiclelayouts_files(&paths) {
                    fs::write(&dest_meta_path, xml)?;
                    merged_meta_files.push(meta_name);
                } else {
                    warnings.push("Failed merging vehiclelayouts.meta files structurally, skipped.".to_string());
                }
            } else if meta_name == "dlctext.meta" {
                // dlctext.meta: merge root items (CExtraTextMetaFile or similar)
                if paths.len() == 1 {
                    let content = fs::read_to_string(&paths[0])?;
                    fs::write(&dest_meta_path, content)?;
                    merged_meta_files.push(meta_name);
                } else if let Ok(xml) = Self::merge_root_items_xml(&paths, "CExtraTextMetaFile") {
                    fs::write(&dest_meta_path, xml)?;
                    merged_meta_files.push(meta_name);
                } else {
                    // Fallback: copy first
                    let content = fs::read_to_string(&paths[0])?;
                    fs::write(&dest_meta_path, content)?;
                    merged_meta_files.push(meta_name);
                }
            } else if meta_name.contains("contentunlocks") {
                // *contentunlocks.meta files: merge root items
                if paths.len() == 1 {
                    let content = fs::read_to_string(&paths[0])?;
                    fs::write(&dest_meta_path, content)?;
                    merged_meta_files.push(meta_name);
                } else if let Ok(xml) = Self::merge_root_items_xml(&paths, "SContentUnlocks") {
                    fs::write(&dest_meta_path, xml)?;
                    merged_meta_files.push(meta_name);
                } else {
                    // Fallback: copy first
                    let content = fs::read_to_string(&paths[0])?;
                    fs::write(&dest_meta_path, content)?;
                    merged_meta_files.push(meta_name);
                }
            } else {
                // For any other unknown meta types: attempt generic XML merge via root items
                if paths.len() == 1 {
                    let content = fs::read_to_string(&paths[0])?;
                    fs::write(&dest_meta_path, content)?;
                    merged_meta_files.push(meta_name);
                } else {
                    // Try to detect root element and merge
                    let first_content = fs::read_to_string(&paths[0])?;
                    let root_tag = Self::detect_root_tag(&first_content);
                    if let Some(ref root) = root_tag {
                        if let Ok(xml) = Self::merge_root_items_xml(&paths, root) {
                            fs::write(&dest_meta_path, xml)?;
                            merged_meta_files.push(meta_name);
                        } else {
                            fs::write(&dest_meta_path, &first_content)?;
                            merged_meta_files.push(meta_name.clone());
                            warnings.push(format!("Meta '{}': XML merge failed, copied first instance.", meta_name));
                        }
                    } else {
                        fs::write(&dest_meta_path, &first_content)?;
                        merged_meta_files.push(meta_name.clone());
                        warnings.push(format!("Meta '{}': could not detect XML root, copied first instance.", meta_name));
                    }
                }
            }
        }

        // 3. Create fxmanifest.lua
        let mut fxmanifest = String::new();
        fxmanifest.push_str("fx_version 'cerulean'\n");
        fxmanifest.push_str("game 'gta5'\n\n");
        fxmanifest.push_str("author 'Dexta Toolkit'\n");
        fxmanifest.push_str("description 'Merged vehicle pack generated by Dexta'\n\n");

        if !merged_meta_files.is_empty() {
            fxmanifest.push_str("files {\n");
            for meta in &merged_meta_files {
                fxmanifest.push_str(&format!("  'data/{}',\n", meta));
            }
            fxmanifest.push_str("}\n\n");

            for meta in &merged_meta_files {
                if meta == "vehicles.meta" {
                    fxmanifest.push_str("data_file 'VEHICLE_METADATA_FILE' 'data/vehicles.meta'\n");
                } else if meta == "handling.meta" {
                    fxmanifest.push_str("data_file 'HANDLING_FILE' 'data/handling.meta'\n");
                } else if meta == "carvariations.meta" {
                    fxmanifest.push_str("data_file 'VEHICLE_VARIATION_FILE' 'data/carvariations.meta'\n");
                } else if meta == "carcols.meta" {
                    fxmanifest.push_str("data_file 'CARCOLS_FILE' 'data/carcols.meta'\n");
                } else if meta == "vehiclelayouts.meta" {
                    fxmanifest.push_str("data_file 'VEHICLE_LAYOUTS_FILE' 'data/vehiclelayouts.meta'\n");
                } else if meta == "dlctext.meta" {
                    fxmanifest.push_str("data_file 'EXTRA_TEXT_META_FILE' 'data/dlctext.meta'\n");
                } else if meta.contains("contentunlocks") {
                    fxmanifest.push_str(&format!("data_file 'CONTENT_UNLOCKING_META_FILE' 'data/{}'\n", meta));
                }
            }
        }

        fs::write(staging_path.join("fxmanifest.lua"), fxmanifest)?;

        // 4. Create Dexta manifest (dexta_manifest.json)
        let report = MergeReport {
            timestamp: chrono::Local::now().to_rfc3339(),
            output_name: output_name.to_string(),
            source_resources: source_names,
            copied_stream_files: copied_stream_files.clone(),
            merged_meta_files,
            warnings: warnings.clone(),
        };

        let manifest_json = serde_json::to_string_pretty(&report)?;
        fs::write(staging_path.join("dexta_manifest.json"), manifest_json)?;

        // 5. Atomic-like rename / swap from staging to output resource path
        if output_resource_path.exists() {
            // Backup output if overwrite
            let backup_name = format!("{}_backup_{}", output_name, chrono::Local::now().format("%Y%m%d_%H%M%S"));
            let backup_path = output_parent_path.join(backup_name);
            fs::rename(&output_resource_path, &backup_path)?;
        }

        fs::rename(&staging_path, &output_resource_path)?;

        Ok(report)
    }
}
