use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
use regex::Regex;
use crate::errors::DextaError;
use crate::vehicle_merger::VehicleMerger;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VehicleHandlingPhysics {
    pub mass: f32,
    pub drag: f32,
    pub downforce_modifier: f32,
    pub percent_submerged: f32,
    pub centre_of_mass_offset: (f32, f32, f32),
    pub inertia_multiplier: (f32, f32, f32),
    pub drive_bias_front: f32,
    pub initial_drive_gears: i32,
    pub drive_force: f32,
    pub drive_inertia: f32,
    pub clutch_change_rate_scale_upshift: f32,
    pub clutch_change_rate_scale_downshift: f32,
    pub initial_drive_max_flat_vel: f32,
    pub brake_force: f32,
    pub brake_bias_front: f32,
    pub hand_brake_force: f32,
    pub steering_lock: f32,
    pub traction_curve_max: f32,
    pub traction_curve_min: f32,
    pub traction_curve_lateral: f32,
    pub traction_spring_delta_max: f32,
    pub low_speed_traction_loss_mult: f32,
    pub camber_stiffnesss: f32,
    pub traction_bias_front: f32,
    pub traction_loss_mult: f32,
    pub suspension_force: f32,
    pub suspension_comp_damp: f32,
    pub suspension_rebound_damp: f32,
    pub suspension_upper_limit: f32,
    pub suspension_lower_limit: f32,
    pub suspension_raise: f32,
    pub suspension_bias_front: f32,
    pub anti_roll_bar_force: f32,
    pub anti_roll_bar_bias_front: f32,
    pub roll_centre_height_front: f32,
    pub roll_centre_height_rear: f32,
    pub collision_damage_mult: f32,
    pub weapon_damage_mult: f32,
    pub damage_mult: f32, // fDeformationDamageMult
    pub engine_damage_mult: f32,
    pub petrol_tank_volume: f32,
    pub oil_volume: f32,
    pub seat_offset_dist_x: f32,
    pub seat_offset_dist_y: f32,
    pub seat_offset_dist_z: f32,
    pub monetary_value: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VehicleConfig {
    pub model_name: String,
    pub handling_id: String,
    pub audio_name_hash: String,
    pub layout: String,
    pub physics: Option<VehicleHandlingPhysics>,
}

pub struct VehicleEditor;

impl VehicleEditor {
    // Locate vehicles.meta and handling.meta inside a directory (recursively check data/ or root)
    fn find_meta_file(dir: &Path, filename: &str) -> Option<PathBuf> {
        // First check in dir root
        let root_check = dir.join(filename);
        if root_check.exists() {
            return Some(root_check);
        }
        let data_check = dir.join("data").join(filename);
        if data_check.exists() {
            return Some(data_check);
        }
        
        // Scan recursively (max depth 3)
        for entry in walkdir::WalkDir::new(dir).max_depth(3).into_iter().filter_map(|e| e.ok()) {
            if entry.file_name().to_string_lossy().to_lowercase() == filename.to_lowercase() {
                return Some(entry.path().to_path_buf());
            }
        }
        None
    }

    pub fn load_configs(resource_dir: &str) -> Result<Vec<VehicleConfig>, DextaError> {
        let dir = Path::new(resource_dir);
        let vehicles_path = Self::find_meta_file(dir, "vehicles.meta")
            .ok_or_else(|| DextaError::Validation("vehicles.meta not found in resource directory".to_string()))?;
        
        let handling_path = Self::find_meta_file(dir, "handling.meta");

        let vehicles_content = fs::read_to_string(&vehicles_path)?;
        
        // Extract vehicle items
        let items = extract_items_local(&vehicles_content, "InitDatas");
        if items.is_empty() {
            return Err(DextaError::Validation("No vehicle entries found in vehicles.meta".to_string()));
        }

        let mut configs = Vec::new();

        // Load handling content if present
        let handling_content = match &handling_path {
            Some(path) => fs::read_to_string(path).ok(),
            None => None,
        };

        for item in items {
            let model_name = VehicleMerger::extract_xml_tags(&item, "modelName").first().cloned().unwrap_or_default();
            if model_name.is_empty() {
                continue;
            }

            let handling_id = VehicleMerger::extract_xml_tags(&item, "handlingId").first().cloned().unwrap_or_else(|| model_name.clone());
            let audio_name_hash = VehicleMerger::extract_xml_tags(&item, "audioNameHash").first().cloned().unwrap_or_default();
            let layout = VehicleMerger::extract_xml_tags(&item, "layout").first().cloned().unwrap_or_default();

            let mut physics = None;

            if let Some(h_content) = &handling_content {
                let h_items = extract_items_local(h_content, "HandlingData");
                for h_item in h_items {
                    let h_name = VehicleMerger::extract_xml_tags(&h_item, "handlingName").first().cloned().unwrap_or_default();
                    if h_name.to_lowercase() == handling_id.to_lowercase() {
                        let mass = extract_value_attr(&h_item, "fMass").unwrap_or(1500.0);
                        let drag = extract_value_attr(&h_item, "fInitialDragCoeff").unwrap_or(10.0);
                        let downforce_modifier = extract_value_attr(&h_item, "fDownforceModifier").unwrap_or(1.0);
                        let percent_submerged = extract_value_attr(&h_item, "fPercentSubmerged").unwrap_or(85.0);
                        let centre_of_mass_offset = extract_vector_attr(&h_item, "vecCentreOfMassOffset").unwrap_or((0.0, 0.0, 0.0));
                        let inertia_multiplier = extract_vector_attr(&h_item, "vecInertiaMultiplier").unwrap_or((1.0, 1.0, 1.0));
                        let drive_bias_front = extract_value_attr(&h_item, "fDriveBiasFront").unwrap_or(0.5);
                        let initial_drive_gears = extract_int_attr(&h_item, "nInitialDriveGears").unwrap_or(6);
                        let drive_force = extract_value_attr(&h_item, "fInitialDriveForce").unwrap_or(0.3);
                        let drive_inertia = extract_value_attr(&h_item, "fDriveInertia").unwrap_or(1.0);
                        let clutch_change_rate_scale_upshift = extract_value_attr(&h_item, "fClutchChangeRateScaleUpShift").unwrap_or(1.0);
                        let clutch_change_rate_scale_downshift = extract_value_attr(&h_item, "fClutchChangeRateScaleDownShift").unwrap_or(1.0);
                        let initial_drive_max_flat_vel = extract_value_attr(&h_item, "fInitialDriveMaxFlatVel").unwrap_or(120.0);
                        let brake_force = extract_value_attr(&h_item, "fBrakeForce").unwrap_or(1.0);
                        let brake_bias_front = extract_value_attr(&h_item, "fBrakeBiasFront").unwrap_or(0.5);
                        let hand_brake_force = extract_value_attr(&h_item, "fHandBrakeForce").unwrap_or(1.0);
                        let steering_lock = extract_value_attr(&h_item, "fSteeringLock").unwrap_or(35.0);
                        let traction_curve_max = extract_value_attr(&h_item, "fTractionCurveMax").unwrap_or(2.0);
                        let traction_curve_min = extract_value_attr(&h_item, "fTractionCurveMin").unwrap_or(1.8);
                        let traction_curve_lateral = extract_value_attr(&h_item, "fTractionCurveLateral").unwrap_or(22.0);
                        let traction_spring_delta_max = extract_value_attr(&h_item, "fTractionSpringDeltaMax").unwrap_or(0.15);
                        let low_speed_traction_loss_mult = extract_value_attr(&h_item, "fLowSpeedTractionLossMult").unwrap_or(1.0);
                        let camber_stiffnesss = extract_value_attr(&h_item, "fCamberStiffnesss").unwrap_or(0.0);
                        let traction_bias_front = extract_value_attr(&h_item, "fTractionBiasFront").unwrap_or(0.5);
                        let traction_loss_mult = extract_value_attr(&h_item, "fTractionLossMult").unwrap_or(1.0);
                        let suspension_force = extract_value_attr(&h_item, "fSuspensionForce").unwrap_or(2.5);
                        let suspension_comp_damp = extract_value_attr(&h_item, "fSuspensionCompDamp").unwrap_or(1.5);
                        let suspension_rebound_damp = extract_value_attr(&h_item, "fSuspensionReboundDamp").unwrap_or(2.0);
                        let suspension_upper_limit = extract_value_attr(&h_item, "fSuspensionUpperLimit").unwrap_or(0.1);
                        let suspension_lower_limit = extract_value_attr(&h_item, "fSuspensionLowerLimit").unwrap_or(-0.1);
                        let suspension_raise = extract_value_attr(&h_item, "fSuspensionRaise").unwrap_or(0.0);
                        let suspension_bias_front = extract_value_attr(&h_item, "fSuspensionBiasFront").unwrap_or(0.5);
                        let anti_roll_bar_force = extract_value_attr(&h_item, "fAntiRollBarForce").unwrap_or(0.5);
                        let anti_roll_bar_bias_front = extract_value_attr(&h_item, "fAntiRollBarBiasFront").unwrap_or(0.5);
                        let roll_centre_height_front = extract_value_attr(&h_item, "fRollCentreHeightFront").unwrap_or(0.1);
                        let roll_centre_height_rear = extract_value_attr(&h_item, "fRollCentreHeightRear").unwrap_or(0.15);
                        let collision_damage_mult = extract_value_attr(&h_item, "fCollisionDamageMult").unwrap_or(0.7);
                        let weapon_damage_mult = extract_value_attr(&h_item, "fWeaponDamageMult").unwrap_or(1.0);
                        let damage_mult = extract_value_attr(&h_item, "fDeformationDamageMult").unwrap_or(0.7);
                        let engine_damage_mult = extract_value_attr(&h_item, "fEngineDamageMult").unwrap_or(1.0);
                        let petrol_tank_volume = extract_value_attr(&h_item, "fPetrolTankVolume").unwrap_or(80.0);
                        let oil_volume = extract_value_attr(&h_item, "fOilVolume").unwrap_or(5.0);
                        let seat_offset_dist_x = extract_value_attr(&h_item, "fSeatOffsetDistX").unwrap_or(0.0);
                        let seat_offset_dist_y = extract_value_attr(&h_item, "fSeatOffsetDistY").unwrap_or(0.0);
                        let seat_offset_dist_z = extract_value_attr(&h_item, "fSeatOffsetDistZ").unwrap_or(0.0);
                        let monetary_value = extract_int_attr(&h_item, "nMonetaryValue").unwrap_or(50000);

                        physics = Some(VehicleHandlingPhysics {
                            mass,
                            drag,
                            downforce_modifier,
                            percent_submerged,
                            centre_of_mass_offset,
                            inertia_multiplier,
                            drive_bias_front,
                            initial_drive_gears,
                            drive_force,
                            drive_inertia,
                            clutch_change_rate_scale_upshift,
                            clutch_change_rate_scale_downshift,
                            initial_drive_max_flat_vel,
                            brake_force,
                            brake_bias_front,
                            hand_brake_force,
                            steering_lock,
                            traction_curve_max,
                            traction_curve_min,
                            traction_curve_lateral,
                            traction_spring_delta_max,
                            low_speed_traction_loss_mult,
                            camber_stiffnesss,
                            traction_bias_front,
                            traction_loss_mult,
                            suspension_force,
                            suspension_comp_damp,
                            suspension_rebound_damp,
                            suspension_upper_limit,
                            suspension_lower_limit,
                            suspension_raise,
                            suspension_bias_front,
                            anti_roll_bar_force,
                            anti_roll_bar_bias_front,
                            roll_centre_height_front,
                            roll_centre_height_rear,
                            collision_damage_mult,
                            weapon_damage_mult,
                            damage_mult,
                            engine_damage_mult,
                            petrol_tank_volume,
                            oil_volume,
                            seat_offset_dist_x,
                            seat_offset_dist_y,
                            seat_offset_dist_z,
                            monetary_value,
                        });
                        break;
                    }
                }
            }

            configs.push(VehicleConfig {
                model_name,
                handling_id,
                audio_name_hash,
                layout,
                physics,
            });
        }

        Ok(configs)
    }

    pub fn save_configs(resource_dir: &str, configs: Vec<VehicleConfig>) -> Result<(), DextaError> {
        let dir = Path::new(resource_dir);
        let vehicles_path = Self::find_meta_file(dir, "vehicles.meta")
            .ok_or_else(|| DextaError::Validation("vehicles.meta not found".to_string()))?;
        
        let handling_path = Self::find_meta_file(dir, "handling.meta");

        let mut vehicles_content = fs::read_to_string(&vehicles_path)?;

        // 1. Update vehicles.meta
        for config in &configs {
            let item_re = Regex::new(&format!(r#"(?s)<Item>\s*<modelName>{}\s*</modelName>.*?</Item>"#, regex::escape(&config.model_name))).unwrap();
            if let Some(m) = item_re.find(&vehicles_content) {
                let mut item_str = m.as_str().to_string();

                // Replace audioNameHash
                let audio_re = Regex::new(r#"<audioNameHash>[^<]*</audioNameHash>"#).unwrap();
                item_str = audio_re.replace(&item_str, &format!("<audioNameHash>{}</audioNameHash>", config.audio_name_hash)).to_string();

                // Replace layout
                let layout_re = Regex::new(r#"<layout>[^<]*</layout>"#).unwrap();
                item_str = layout_re.replace(&item_str, &format!("<layout>{}</layout>", config.layout)).to_string();

                // Replace handlingId
                let handling_re = Regex::new(r#"<handlingId>[^<]*</handlingId>"#).unwrap();
                item_str = handling_re.replace(&item_str, &format!("<handlingId>{}</handlingId>", config.handling_id)).to_string();

                vehicles_content = vehicles_content.replace(m.as_str(), &item_str);
            }
        }
        fs::write(&vehicles_path, vehicles_content)?;

        // 2. Update handling.meta (if present and physics config is updated)
        if let Some(h_path) = handling_path {
            let mut handling_content = fs::read_to_string(&h_path)?;
            let mut modified = false;

            for config in &configs {
                if let Some(physics) = &config.physics {
                    // Match handling item by name
                    let item_re = Regex::new(&format!(r#"(?s)<Item[^>]*>\s*<handlingName>{}\s*</handlingName>.*?</Item>"#, regex::escape(&config.handling_id))).unwrap();
                    if let Some(m) = item_re.find(&handling_content) {
                        let mut item_str = m.as_str().to_string();

                        item_str = replace_value_attr(&item_str, "fMass", physics.mass);
                        item_str = replace_value_attr(&item_str, "fInitialDragCoeff", physics.drag);
                        item_str = replace_value_attr(&item_str, "fDownforceModifier", physics.downforce_modifier);
                        item_str = replace_value_attr(&item_str, "fPercentSubmerged", physics.percent_submerged);
                        item_str = replace_vector_attr(&item_str, "vecCentreOfMassOffset", physics.centre_of_mass_offset);
                        item_str = replace_vector_attr(&item_str, "vecInertiaMultiplier", physics.inertia_multiplier);
                        item_str = replace_value_attr(&item_str, "fDriveBiasFront", physics.drive_bias_front);
                        item_str = replace_int_attr(&item_str, "nInitialDriveGears", physics.initial_drive_gears);
                        item_str = replace_value_attr(&item_str, "fInitialDriveForce", physics.drive_force);
                        item_str = replace_value_attr(&item_str, "fDriveInertia", physics.drive_inertia);
                        item_str = replace_value_attr(&item_str, "fClutchChangeRateScaleUpShift", physics.clutch_change_rate_scale_upshift);
                        item_str = replace_value_attr(&item_str, "fClutchChangeRateScaleDownShift", physics.clutch_change_rate_scale_downshift);
                        item_str = replace_value_attr(&item_str, "fInitialDriveMaxFlatVel", physics.initial_drive_max_flat_vel);
                        item_str = replace_value_attr(&item_str, "fBrakeForce", physics.brake_force);
                        item_str = replace_value_attr(&item_str, "fBrakeBiasFront", physics.brake_bias_front);
                        item_str = replace_value_attr(&item_str, "fHandBrakeForce", physics.hand_brake_force);
                        item_str = replace_value_attr(&item_str, "fSteeringLock", physics.steering_lock);
                        item_str = replace_value_attr(&item_str, "fTractionCurveMax", physics.traction_curve_max);
                        item_str = replace_value_attr(&item_str, "fTractionCurveMin", physics.traction_curve_min);
                        item_str = replace_value_attr(&item_str, "fTractionCurveLateral", physics.traction_curve_lateral);
                        item_str = replace_value_attr(&item_str, "fTractionSpringDeltaMax", physics.traction_spring_delta_max);
                        item_str = replace_value_attr(&item_str, "fLowSpeedTractionLossMult", physics.low_speed_traction_loss_mult);
                        item_str = replace_value_attr(&item_str, "fCamberStiffnesss", physics.camber_stiffnesss);
                        item_str = replace_value_attr(&item_str, "fTractionBiasFront", physics.traction_bias_front);
                        item_str = replace_value_attr(&item_str, "fTractionLossMult", physics.traction_loss_mult);
                        item_str = replace_value_attr(&item_str, "fSuspensionForce", physics.suspension_force);
                        item_str = replace_value_attr(&item_str, "fSuspensionCompDamp", physics.suspension_comp_damp);
                        item_str = replace_value_attr(&item_str, "fSuspensionReboundDamp", physics.suspension_rebound_damp);
                        item_str = replace_value_attr(&item_str, "fSuspensionUpperLimit", physics.suspension_upper_limit);
                        item_str = replace_value_attr(&item_str, "fSuspensionLowerLimit", physics.suspension_lower_limit);
                        item_str = replace_value_attr(&item_str, "fSuspensionRaise", physics.suspension_raise);
                        item_str = replace_value_attr(&item_str, "fSuspensionBiasFront", physics.suspension_bias_front);
                        item_str = replace_value_attr(&item_str, "fAntiRollBarForce", physics.anti_roll_bar_force);
                        item_str = replace_value_attr(&item_str, "fAntiRollBarBiasFront", physics.anti_roll_bar_bias_front);
                        item_str = replace_value_attr(&item_str, "fRollCentreHeightFront", physics.roll_centre_height_front);
                        item_str = replace_value_attr(&item_str, "fRollCentreHeightRear", physics.roll_centre_height_rear);
                        item_str = replace_value_attr(&item_str, "fCollisionDamageMult", physics.collision_damage_mult);
                        item_str = replace_value_attr(&item_str, "fWeaponDamageMult", physics.weapon_damage_mult);
                        item_str = replace_value_attr(&item_str, "fDeformationDamageMult", physics.damage_mult);
                        item_str = replace_value_attr(&item_str, "fEngineDamageMult", physics.engine_damage_mult);
                        item_str = replace_value_attr(&item_str, "fPetrolTankVolume", physics.petrol_tank_volume);
                        item_str = replace_value_attr(&item_str, "fOilVolume", physics.oil_volume);
                        item_str = replace_value_attr(&item_str, "fSeatOffsetDistX", physics.seat_offset_dist_x);
                        item_str = replace_value_attr(&item_str, "fSeatOffsetDistY", physics.seat_offset_dist_y);
                        item_str = replace_value_attr(&item_str, "fSeatOffsetDistZ", physics.seat_offset_dist_z);
                        item_str = replace_int_attr(&item_str, "nMonetaryValue", physics.monetary_value);

                        handling_content = handling_content.replace(m.as_str(), &item_str);
                        modified = true;
                    }
                }
            }

            if modified {
                fs::write(h_path, handling_content)?;
            }
        }

        Ok(())
    }
}

// Local helpers
fn extract_items_local(content: &str, parent_tag: &str) -> Vec<String> {
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
    
    let mut items = Vec::new();
    let mut pos = 0;

    while let Some(start_idx) = inner_content[pos..].find("<Item") {
        let abs_start = pos + start_idx;

        if let Some(tag_end) = inner_content[abs_start..].find('>') {
            let abs_tag_end = abs_start + tag_end;
            let header = &inner_content[abs_start..=abs_tag_end];
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

        while let Some(next_tag) = inner_content[search_pos..].find('<') {
            let abs_next_tag = search_pos + next_tag;
            if inner_content[abs_next_tag..].starts_with("<!--") {
                if let Some(comment_end) = inner_content[abs_next_tag..].find("-->") {
                    search_pos = abs_next_tag + comment_end + 3;
                    continue;
                }
            }

            if let Some(tag_end) = inner_content[abs_next_tag..].find('>') {
                let abs_tag_end = abs_next_tag + tag_end;
                let tag_header = &inner_content[abs_next_tag + 1..abs_tag_end];

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
            let item_block = inner_content[abs_start..match_end_idx].to_string();
            items.push(item_block);
            pos = match_end_idx;
        } else {
            pos = abs_start + 1;
        }
    }
    items
}

fn extract_value_attr(item: &str, tag: &str) -> Option<f32> {
    let re = Regex::new(&format!(r#"<{}\s+value="([^"]+)""#, regex::escape(tag))).unwrap();
    re.captures(item)
        .and_then(|cap| cap[1].parse::<f32>().ok())
}

fn replace_value_attr(item: &str, tag: &str, value: f32) -> String {
    let re = Regex::new(&format!(r#"(<{}\s+value=")[^"]+(")"#, regex::escape(tag))).unwrap();
    re.replace(item, &format!("${{1}}{:.6}${{2}}", value)).to_string()
}

fn extract_int_attr(item: &str, tag: &str) -> Option<i32> {
    let re = Regex::new(&format!(r#"<{}\s+value="([^"]+)""#, regex::escape(tag))).unwrap();
    re.captures(item)
        .and_then(|cap| cap[1].parse::<i32>().ok())
}

fn replace_int_attr(item: &str, tag: &str, value: i32) -> String {
    let re = Regex::new(&format!(r#"(<{}\s+value=")[^"]+(")"#, regex::escape(tag))).unwrap();
    re.replace(item, &format!("${{1}}{}${{2}}", value)).to_string()
}

fn extract_vector_attr(item: &str, tag: &str) -> Option<(f32, f32, f32)> {
    let re_tag = Regex::new(&format!(r#"<{}\s+([^>]*)/?>"#, regex::escape(tag))).unwrap();
    let cap = re_tag.captures(item)?;
    let attrs = &cap[1];
    
    let re_x = Regex::new(r#"x="([^"]*)""#).unwrap();
    let re_y = Regex::new(r#"y="([^"]*)""#).unwrap();
    let re_z = Regex::new(r#"z="([^"]*)""#).unwrap();
    
    let x = re_x.captures(attrs).and_then(|c| c[1].parse::<f32>().ok())?;
    let y = re_y.captures(attrs).and_then(|c| c[1].parse::<f32>().ok())?;
    let z = re_z.captures(attrs).and_then(|c| c[1].parse::<f32>().ok())?;
    
    Some((x, y, z))
}

fn replace_vector_attr(item: &str, tag: &str, val: (f32, f32, f32)) -> String {
    let re_tag = Regex::new(&format!(r#"<{}\s+([^>]*)/?>"#, regex::escape(tag))).unwrap();
    if let Some(cap) = re_tag.captures(item) {
        let matched = cap.get(0).unwrap().as_str();
        let new_tag = format!(r#"<{} x="{:.6}" y="{:.6}" z="{:.6}" />"#, tag, val.0, val.1, val.2);
        item.replace(matched, &new_tag)
    } else {
        item.to_string()
    }
}

