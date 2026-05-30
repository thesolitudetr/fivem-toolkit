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

#[derive(Debug, Clone)]
pub struct XmlNode {
    pub tag_name: String,
    pub attributes: String,
    pub inner_content: String,
    pub is_self_closing: bool,
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

    // Helper struct to represent a child XML element under the root tag
    fn parse_child_nodes(content: &str) -> Vec<XmlNode> {
        let mut nodes = Vec::new();
        let mut pos = 0;

        while let Some(start_idx) = content[pos..].find('<') {
            let abs_start = pos + start_idx;

            // Skip comments
            if content[abs_start..].starts_with("<!--") {
                if let Some(comment_end) = content[abs_start..].find("-->") {
                    pos = abs_start + comment_end + 3;
                    continue;
                }
            }

            // Skip XML declarations
            if content[abs_start..].starts_with("<?") {
                if let Some(pi_end) = content[abs_start..].find("?>") {
                    pos = abs_start + pi_end + 2;
                    continue;
                }
            }

            // Skip closing tags
            if content[abs_start..].starts_with("</") {
                if let Some(tag_end) = content[abs_start..].find('>') {
                    pos = abs_start + tag_end + 1;
                    continue;
                }
            }

            // Parse opening tag
            if let Some(tag_end) = content[abs_start..].find('>') {
                let abs_tag_end = abs_start + tag_end;
                let tag_header = &content[abs_start + 1..abs_tag_end];

                let is_self_closing = tag_header.ends_with('/');
                let clean_header = if is_self_closing {
                    tag_header[..tag_header.len() - 1].trim()
                } else {
                    tag_header.trim()
                };

                let parts: Vec<&str> = clean_header.splitn(2, ' ').collect();
                let tag_name = parts[0].to_string();
                let attributes = if parts.len() > 1 {
                    parts[1].to_string()
                } else {
                    String::new()
                };

                if is_self_closing {
                    nodes.push(XmlNode {
                        tag_name,
                        attributes,
                        inner_content: String::new(),
                        is_self_closing: true,
                    });
                    pos = abs_tag_end + 1;
                } else {
                    let closing_tag = format!("</{}>", tag_name);
                    if let Some(close_idx) = content[abs_tag_end..].find(&closing_tag) {
                        let abs_close_start = abs_tag_end + close_idx;
                        let inner_content = content[abs_tag_end + 1..abs_close_start].to_string();
                        nodes.push(XmlNode {
                            tag_name,
                            attributes,
                            inner_content,
                            is_self_closing: false,
                        });
                        pos = abs_close_start + closing_tag.len();
                    } else {
                        pos = abs_tag_end + 1;
                    }
                }
            } else {
                pos = abs_start + 1;
            }
        }
        nodes
    }

    // Helper to extract <Item> elements from a block of XML, tracking nesting depth
    fn extract_items(content: &str) -> Vec<String> {
        let mut items = Vec::new();
        let mut pos = 0;

        while let Some(start_idx) = content[pos..].find("<Item") {
            let abs_start = pos + start_idx;

            // Check self-closing Item
            if let Some(tag_end) = content[abs_start..].find('>') {
                let abs_tag_end = abs_start + tag_end;
                let header = &content[abs_start..=abs_tag_end];
                if header.ends_with("/>") {
                    items.push(header.to_string());
                    pos = abs_tag_end + 1;
                    continue;
                }
            }

            // Nesting depth tracker
            let mut depth = 0;
            let mut search_pos = abs_start;
            let mut found_match = false;
            let mut match_end_idx = 0;

            while let Some(next_tag) = content[search_pos..].find('<') {
                let abs_next_tag = search_pos + next_tag;
                if content[abs_next_tag..].starts_with("<!--") {
                    if let Some(comment_end) = content[abs_next_tag..].find("-->") {
                        search_pos = abs_next_tag + comment_end + 3;
                        continue;
                    }
                }
                if content[abs_next_tag..].starts_with("<?") {
                    if let Some(pi_end) = content[abs_next_tag..].find("?>") {
                        search_pos = abs_next_tag + pi_end + 2;
                        continue;
                    }
                }

                if let Some(tag_end) = content[abs_next_tag..].find('>') {
                    let abs_tag_end = abs_next_tag + tag_end;
                    let tag_header = &content[abs_next_tag + 1..abs_tag_end];

                    let is_closing = tag_header.starts_with('/');
                    let is_self_closing = tag_header.ends_with('/');

                    let clean_header = if is_closing {
                        &tag_header[1..]
                    } else if is_self_closing {
                        &tag_header[..tag_header.len() - 1]
                    } else {
                        tag_header
                    };

                    let tag_name = clean_header.trim().split_whitespace().next().unwrap_or("");
                    if tag_name == "Item" {
                        if is_closing {
                            depth -= 1;
                            if depth == 0 {
                                found_match = true;
                                match_end_idx = abs_tag_end + 1;
                                break;
                            }
                        } else if !is_self_closing {
                            depth += 1;
                        }
                    }
                    search_pos = abs_tag_end + 1;
                } else {
                    search_pos = abs_next_tag + 1;
                }
            }

            if found_match {
                let item_block = content[abs_start..match_end_idx].to_string();
                items.push(item_block);
                pos = match_end_idx;
            } else {
                pos = abs_start + 1;
            }
        }
        items
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

    /// Universally merge multiple vehicle meta files by root tag detection,
    /// grouping child elements, and combining lists of <Item> tags.
    pub fn merge_vehicle_meta_files(files: &[PathBuf]) -> Result<String, DextaError> {
        if files.is_empty() {
            return Ok(String::new());
        }

        let first_content = fs::read_to_string(&files[0])?;
        let root_tag = Self::detect_root_tag(&first_content)
            .ok_or_else(|| DextaError::Other("Could not detect root XML tag in meta file".to_string()))?;

        // Extract XML header before root tag
        let root_start_tag = format!("<{}", root_tag);
        let header = if let Some(pos) = first_content.find(&root_start_tag) {
            first_content[..pos].to_string()
        } else {
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".to_string()
        };

        let mut grouped_nodes: HashMap<String, Vec<XmlNode>> = HashMap::new();
        let mut tag_order: Vec<String> = Vec::new();

        for path in files {
            let content = fs::read_to_string(path)?;

            // Extract content inside <root_tag...> ... </root_tag>
            let re_start = Regex::new(&format!(r#"<{}(?:\s+[^>]*)?>"#, regex::escape(&root_tag))).unwrap();
            let start_idx = if let Some(m) = re_start.find(&content) {
                m.end()
            } else {
                continue;
            };

            let end_tag = format!("</{}>", root_tag);
            let end_idx = if let Some(pos) = content.rfind(&end_tag) {
                pos
            } else {
                continue;
            };

            let inner_root_content = &content[start_idx..end_idx];
            let nodes = Self::parse_child_nodes(inner_root_content);

            for node in nodes {
                if !grouped_nodes.contains_key(&node.tag_name) {
                    grouped_nodes.insert(node.tag_name.clone(), Vec::new());
                    tag_order.push(node.tag_name.clone());
                }
                grouped_nodes.get_mut(&node.tag_name).unwrap().push(node);
            }
        }

        let mut merged_tags = Vec::new();
        for tag_name in tag_order {
            if let Some(node_list) = grouped_nodes.get(&tag_name) {
                if node_list.is_empty() {
                    continue;
                }

                // Treat as list if any file's version of the tag contains "<Item"
                let is_list = node_list.iter().any(|n| n.inner_content.contains("<Item"));

                if is_list {
                    let mut all_items = Vec::new();
                    for node in node_list {
                        all_items.extend(Self::extract_items(&node.inner_content));
                    }

                    let merged_items = all_items.join("\n    ");
                    let attrs_str = if !node_list[0].attributes.is_empty() {
                        format!(" {}", node_list[0].attributes)
                    } else {
                        String::new()
                    };

                    merged_tags.push(format!(
                        "  <{tag_name}{attrs_str}>\n    {merged_items}\n  </{tag_name}>",
                        tag_name = tag_name,
                        attrs_str = attrs_str,
                        merged_items = merged_items
                    ));
                } else {
                    // Non-list (e.g. residentTxd): keep first occurrence
                    let first_node = &node_list[0];
                    let attrs_str = if !first_node.attributes.is_empty() {
                        format!(" {}", first_node.attributes)
                    } else {
                        String::new()
                    };

                    if first_node.is_self_closing {
                        merged_tags.push(format!("  <{}{} />", tag_name, attrs_str));
                    } else {
                        merged_tags.push(format!(
                            "  <{attrs}>{inner}</{tag}>",
                            attrs = format!("{}{}", tag_name, attrs_str),
                            inner = first_node.inner_content.trim(),
                            tag = tag_name
                        ));
                    }
                }
            }
        }

        let body = merged_tags.join("\n");
        let merged_xml = format!(
            "{header}<{root_tag}>\n{body}\n</{root_tag}>",
            header = header,
            root_tag = root_tag,
            body = body
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
            let is_stream_asset = |filename: &str| {
                let lower = filename.to_lowercase();
                let ext = Path::new(&lower)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("");
                !matches!(ext, "png" | "dds" | "txt" | "json" | "md" | "git" | "db" | "ini" | "cfg" | "bak")
            };

            for file in &res.files {
                let src_path = Path::new(&file.path);
                if file.relative_path.to_lowercase().starts_with("stream/") {
                    if is_stream_asset(&file.name) {
                        let dest_file = stream_dest.join(&file.name);
                        fs::copy(src_path, &dest_file)?;
                        copied_stream_files.push(file.name.clone());
                    } else {
                        warnings.push(format!(
                            "Skipped copying non-streaming asset '{}' from stream folder.",
                            file.name
                        ));
                    }
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
            match Self::merge_vehicle_meta_files(&paths) {
                Ok(xml) => {
                    fs::write(&dest_meta_path, xml)?;
                    merged_meta_files.push(meta_name);
                }
                Err(e) => {
                    warnings.push(format!("Failed merging {} structurally: {}", meta_name, e));
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
                let meta_lower = meta.to_lowercase();
                if meta_lower == "vehicles.meta" || meta_lower.contains("vehicles") {
                    fxmanifest.push_str(&format!("data_file 'VEHICLE_METADATA_FILE' 'data/{}'\n", meta));
                } else if meta_lower == "handling.meta" || meta_lower.contains("handling") {
                    fxmanifest.push_str(&format!("data_file 'HANDLING_FILE' 'data/{}'\n", meta));
                } else if meta_lower == "carvariations.meta" || meta_lower.contains("carvariations") {
                    fxmanifest.push_str(&format!("data_file 'VEHICLE_VARIATION_FILE' 'data/{}'\n", meta));
                } else if meta_lower == "carcols.meta" || meta_lower.contains("carcols") {
                    fxmanifest.push_str(&format!("data_file 'CARCOLS_FILE' 'data/{}'\n", meta));
                } else if meta_lower == "vehiclelayouts.meta" || meta_lower.contains("vehiclelayouts") || meta_lower.contains("layout") {
                    fxmanifest.push_str(&format!("data_file 'VEHICLE_LAYOUTS_FILE' 'data/{}'\n", meta));
                } else if meta_lower == "dlctext.meta" || meta_lower.contains("dlctext") {
                    fxmanifest.push_str(&format!("data_file 'DLC_TEXT_FILE' 'data/{}'\n", meta));
                } else if meta_lower.contains("contentunlocks") {
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
