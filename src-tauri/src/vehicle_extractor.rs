use std::fs;
use std::path::Path;
use regex::Regex;
use crate::errors::DextaError;
use crate::vehicle_merger::{VehicleMerger, XmlNode};

pub struct VehicleExtractor;

impl VehicleExtractor {
    pub fn extract(
        pack_path: &str,
        vehicle_name: &str,
        output_dir: &str,
    ) -> Result<String, DextaError> {
        let src_path = Path::new(pack_path);
        let dest_path = Path::new(output_dir).join(vehicle_name);

        if !src_path.exists() {
            return Err(DextaError::Validation("Source pack path does not exist".to_string()));
        }

        // Create dest dirs
        let stream_dest = dest_path.join("stream");
        let data_dest = dest_path.join("data");
        fs::create_dir_all(&stream_dest)?;
        fs::create_dir_all(&data_dest)?;

        let mut copied_files = Vec::new();
        let mut created_meta_files = Vec::new();

        // 1. Copy stream files matching vehicle_name
        let src_stream = src_path.join("stream");
        if src_stream.exists() && src_stream.is_dir() {
            let re_stream = Regex::new(&format!(r#"(?i)^{}[._+]"#, regex::escape(vehicle_name))).unwrap();
            for entry in fs::read_dir(src_stream)? {
                let entry = entry?;
                let file_name = entry.file_name().to_string_lossy().to_string();
                if re_stream.is_match(&file_name) || file_name.to_lowercase() == vehicle_name.to_lowercase() {
                    let dest_file = stream_dest.join(&file_name);
                    fs::copy(entry.path(), dest_file)?;
                    copied_files.push(file_name);
                }
            }
        }

        // 2. Extract vehicles.meta
        let src_vehicles_meta = src_path.join("data").join("vehicles.meta");
        let mut handling_id = vehicle_name.to_string();
        let mut kit_names = Vec::new();

        if src_vehicles_meta.exists() {
            let content = fs::read_to_string(&src_vehicles_meta)?;
            // Extract InitDatas <Item>
            let init_datas_items = extract_items_with_tag_val(&content, "InitDatas", "modelName", vehicle_name);
            
            if !init_datas_items.is_empty() {
                // Find handlingId and layout from the extracted item
                let item_content = &init_datas_items[0];
                if let Some(h_id) = VehicleMerger::extract_xml_tags(item_content, "handlingId").first() {
                    handling_id = h_id.clone();
                }
                
                // Extract txdRelationships <Item> where parent or child is vehicle_name
                let txd_items = extract_items_with_any_tag_val(&content, "txdRelationships", &["parent", "child"], vehicle_name);

                // Build new vehicles.meta content
                let mut body = String::new();
                body.push_str("  <InitDatas>\n");
                for item in &init_datas_items {
                    body.push_str(&format!("    {}\n", item.trim()));
                }
                body.push_str("  </InitDatas>\n");

                if !txd_items.is_empty() {
                    body.push_str("  <txdRelationships>\n");
                    for item in &txd_items {
                        body.push_str(&format!("    {}\n", item.trim()));
                    }
                    body.push_str("  </txdRelationships>\n");
                }

                // Detect original header/root
                let root_tag = VehicleMerger::detect_root_tag(&content).unwrap_or_else(|| "CVehicleModelInfo__InitDataList".to_string());
                let header = extract_xml_header(&content, &root_tag);
                let merged_xml = format!("{}{}<{}>\n{}\n</{}>", header, get_indentation(&header), root_tag, body, root_tag);
                fs::write(data_dest.join("vehicles.meta"), merged_xml)?;
                created_meta_files.push("vehicles.meta".to_string());
            }
        }

        // 3. Extract handling.meta
        let src_handling_meta = src_path.join("data").join("handling.meta");
        if src_handling_meta.exists() {
            let content = fs::read_to_string(&src_handling_meta)?;
            let handling_items = extract_items_with_tag_val(&content, "HandlingData", "handlingName", &handling_id);

            if !handling_items.is_empty() {
                let mut body = String::new();
                body.push_str("  <HandlingData>\n");
                for item in &handling_items {
                    body.push_str(&format!("    {}\n", item.trim()));
                }
                body.push_str("  </HandlingData>\n");

                let root_tag = VehicleMerger::detect_root_tag(&content).unwrap_or_else(|| "CHandlingDataMgr".to_string());
                let header = extract_xml_header(&content, &root_tag);
                let merged_xml = format!("{}{}<{}>\n{}\n</{}>", header, get_indentation(&header), root_tag, body, root_tag);
                fs::write(data_dest.join("handling.meta"), merged_xml)?;
                created_meta_files.push("handling.meta".to_string());
            }
        }

        // 4. Extract carvariations.meta
        let src_var_meta = src_path.join("data").join("carvariations.meta");
        if src_var_meta.exists() {
            let content = fs::read_to_string(&src_var_meta)?;
            let var_items = extract_items_with_tag_val(&content, "variationData", "modelName", vehicle_name);

            if !var_items.is_empty() {
                // Find any kitName referenced
                for item in &var_items {
                    let kits = VehicleMerger::extract_xml_tags(item, "kitName");
                    for k in kits {
                        if k.to_lowercase() != "null_shana" && !kit_names.contains(&k) {
                            kit_names.push(k);
                        }
                    }
                }

                let mut body = String::new();
                body.push_str("  <variationData>\n");
                for item in &var_items {
                    body.push_str(&format!("    {}\n", item.trim()));
                }
                body.push_str("  </variationData>\n");

                let root_tag = VehicleMerger::detect_root_tag(&content).unwrap_or_else(|| "CVehicleModelInfoVariation".to_string());
                let header = extract_xml_header(&content, &root_tag);
                let merged_xml = format!("{}{}<{}>\n{}\n</{}>", header, get_indentation(&header), root_tag, body, root_tag);
                fs::write(data_dest.join("carvariations.meta"), merged_xml)?;
                created_meta_files.push("carvariations.meta".to_string());
            }
        }

        // 5. Extract carcols.meta
        let src_cols_meta = src_path.join("data").join("carcols.meta");
        if src_cols_meta.exists() {
            let content = fs::read_to_string(&src_cols_meta)?;
            let mut kit_items = Vec::new();
            for kit_name in &kit_names {
                let items = extract_items_with_tag_val(&content, "Kits", "kitName", kit_name);
                kit_items.extend(items);
            }

            // If we have kits, or we want to look for lights containing vehicle name
            if !kit_items.is_empty() {
                let mut body = String::new();
                body.push_str("  <Kits>\n");
                for item in &kit_items {
                    body.push_str(&format!("    {}\n", item.trim()));
                }
                body.push_str("  </Kits>\n");

                // Also copy Lights entirely if present since lights are small and shared
                let child_nodes = parse_child_nodes_from_content(&content);
                if let Some(lights_node) = child_nodes.iter().find(|n| n.tag_name == "Lights") {
                    body.push_str(&format!("  <Lights>\n    {}\n  </Lights>\n", lights_node.inner_content.trim()));
                }

                let root_tag = VehicleMerger::detect_root_tag(&content).unwrap_or_else(|| "CVehicleModelInfoVarCol".to_string());
                let header = extract_xml_header(&content, &root_tag);
                let merged_xml = format!("{}{}<{}>\n{}\n</{}>", header, get_indentation(&header), root_tag, body, root_tag);
                fs::write(data_dest.join("carcols.meta"), merged_xml)?;
                created_meta_files.push("carcols.meta".to_string());
            }
        }

        // 6. Create fxmanifest.lua
        let mut fxmanifest = String::new();
        fxmanifest.push_str("fx_version 'cerulean'\n");
        fxmanifest.push_str("game 'gta5'\n\n");
        fxmanifest.push_str(&format!("author 'Dexta Toolkit - Extracted: {}'\n\n", vehicle_name));

        if !created_meta_files.is_empty() {
            fxmanifest.push_str("files {\n");
            for meta in &created_meta_files {
                fxmanifest.push_str(&format!("  'data/{}',\n", meta));
            }
            fxmanifest.push_str("}\n\n");

            for meta in &created_meta_files {
                if meta == "vehicles.meta" {
                    fxmanifest.push_str("data_file 'VEHICLE_METADATA_FILE' 'data/vehicles.meta'\n");
                } else if meta == "handling.meta" {
                    fxmanifest.push_str("data_file 'HANDLING_FILE' 'data/handling.meta'\n");
                } else if meta == "carvariations.meta" {
                    fxmanifest.push_str("data_file 'VEHICLE_VARIATION_FILE' 'data/carvariations.meta'\n");
                } else if meta == "carcols.meta" {
                    fxmanifest.push_str("data_file 'CARCOLS_FILE' 'data/carcols.meta'\n");
                }
            }
        }

        fs::write(dest_path.join("fxmanifest.lua"), fxmanifest)?;

        Ok(dest_path.to_string_lossy().to_string().replace('\\', "/"))
    }
}

// Helpers for extraction
fn extract_xml_header(content: &str, root_tag: &str) -> String {
    let search = format!("<{}", root_tag);
    if let Some(pos) = content.find(&search) {
        content[..pos].to_string()
    } else {
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n".to_string()
    }
}

fn get_indentation(header: &str) -> String {
    if let Some(last_line) = header.lines().last() {
        let trimmed_len = last_line.trim_start().len();
        last_line[..last_line.len() - trimmed_len].to_string()
    } else {
        String::new()
    }
}

fn extract_items_with_tag_val(content: &str, parent_tag: &str, tag_to_check: &str, value_to_match: &str) -> Vec<String> {
    let start_re = Regex::new(&format!(r#"<{}(?:\s+[^>]*)?>"#, regex::escape(parent_tag))).unwrap();
    let end_tag = format!("</{}>", parent_tag);
    
    let start_idx = match start_re.find(content) {
        Some(m) => m.end(),
        None => return Vec::new(),
    };
    
    let end_idx = match content[start_idx..].find(&end_tag) {
        Some(pos) => start_idx + pos,
        None => return Vec::new(),
    };

    let inner_content = &content[start_idx..end_idx];
    let items = extract_items_local(inner_content);
    
    let check_re = Regex::new(&format!(r#"(?i)<{}>\s*{}\s*</{}>"#, regex::escape(tag_to_check), regex::escape(value_to_match), regex::escape(tag_to_check))).unwrap();
    
    items.into_iter()
        .filter(|item| check_re.is_match(item))
        .collect()
}

fn extract_items_with_any_tag_val(content: &str, parent_tag: &str, tags_to_check: &[&str], value_to_match: &str) -> Vec<String> {
    let start_re = Regex::new(&format!(r#"<{}(?:\s+[^>]*)?>"#, regex::escape(parent_tag))).unwrap();
    let end_tag = format!("</{}>", parent_tag);
    
    let start_idx = match start_re.find(content) {
        Some(m) => m.end(),
        None => return Vec::new(),
    };
    
    let end_idx = match content[start_idx..].find(&end_tag) {
        Some(pos) => start_idx + pos,
        None => return Vec::new(),
    };

    let inner_content = &content[start_idx..end_idx];
    let items = extract_items_local(inner_content);
    
    let mut check_regexes = Vec::new();
    for tag in tags_to_check {
        check_regexes.push(Regex::new(&format!(r#"(?i)<{}>\s*{}\s*</{}>"#, regex::escape(tag), regex::escape(value_to_match), regex::escape(tag))).unwrap());
    }
    
    items.into_iter()
        .filter(|item| {
            check_regexes.iter().any(|re| re.is_match(item))
        })
        .collect()
}

fn extract_items_local(content: &str) -> Vec<String> {
    let mut items = Vec::new();
    let mut pos = 0;

    while let Some(start_idx) = content[pos..].find("<Item") {
        let abs_start = pos + start_idx;

        if let Some(tag_end) = content[abs_start..].find('>') {
            let abs_tag_end = abs_start + tag_end;
            let header = &content[abs_start..=abs_tag_end];
            if header.ends_with("/>") {
                items.push(header.to_string());
                pos = abs_tag_end + 1;
                continue;
            }
        }

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

fn parse_child_nodes_from_content(content: &str) -> Vec<XmlNode> {
    let root_tag = match VehicleMerger::detect_root_tag(content) {
        Some(tag) => tag,
        None => return Vec::new(),
    };

    let re_start = Regex::new(&format!(r#"<{}(?:\s+[^>]*)?>"#, regex::escape(&root_tag))).unwrap();
    let start_idx = match re_start.find(content) {
        Some(m) => m.end(),
        None => return Vec::new(),
    };

    let end_tag = format!("</{}>", root_tag);
    let end_idx = match content.rfind(&end_tag) {
        Some(pos) => pos,
        None => return Vec::new(),
    };

    let inner_root_content = &content[start_idx..end_idx];

    let mut nodes = Vec::new();
    let mut pos = 0;

    while let Some(start_idx) = inner_root_content[pos..].find('<') {
        let abs_start = pos + start_idx;

        if inner_root_content[abs_start..].starts_with("<!--") {
            if let Some(comment_end) = inner_root_content[abs_start..].find("-->") {
                pos = abs_start + comment_end + 3;
                continue;
            }
        }

        if inner_root_content[abs_start..].starts_with("<?") {
            if let Some(pi_end) = inner_root_content[abs_start..].find("?>") {
                pos = abs_start + pi_end + 2;
                continue;
            }
        }

        if inner_root_content[abs_start..].starts_with("</") {
            if let Some(tag_end) = inner_root_content[abs_start..].find('>') {
                pos = abs_start + tag_end + 1;
                continue;
            }
        }

        if let Some(tag_end) = inner_root_content[abs_start..].find('>') {
            let abs_tag_end = abs_start + tag_end;
            let tag_header = &inner_root_content[abs_start + 1..abs_tag_end];

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
                if let Some(close_idx) = inner_root_content[abs_tag_end..].find(&closing_tag) {
                    let abs_close_start = abs_tag_end + close_idx;
                    let inner_content = inner_root_content[abs_tag_end + 1..abs_close_start].to_string();
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
