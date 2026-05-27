use serde::{Serialize, Deserialize};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use crate::errors::DextaError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScannedFile {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub size: u64,
    pub category: String, // "yft" | "ytd" | "ydd" | "awc" | "ymap" | "ytyp" | "meta" | "lua" | "other"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FiveMResource {
    pub name: String,
    pub path: String,
    pub has_manifest: bool,
    pub manifest_type: String, // "fxmanifest" | "resource" | "none"
    pub manifest_content: String,
    pub files: Vec<ScannedFile>,
    pub total_size: u64,
    pub stream_size: u64,
    pub meta_files: Vec<String>, // list of detected .meta relative paths
}

pub struct ResourceDetector;

impl ResourceDetector {
    pub fn classify_file(path: &Path) -> String {
        match path.extension().and_then(|ext| ext.to_str()) {
            Some(ext) => {
                let ext_lower = ext.to_lowercase();
                if ext_lower == "yft" {
                    "yft".to_string()
                } else if ext_lower == "ytd" {
                    "ytd".to_string()
                } else if ext_lower == "ydd" {
                    "ydd".to_string()
                } else if ext_lower == "awc" {
                    "awc".to_string()
                } else if ext_lower == "ymap" {
                    "ymap".to_string()
                } else if ext_lower == "ytyp" {
                    "ytyp".to_string()
                } else if ext_lower == "meta" || ext_lower == "xml" {
                    "meta".to_string()
                } else if ext_lower == "lua" {
                    "lua".to_string()
                } else {
                    "other".to_string()
                }
            }
            None => "other".to_string(),
        }
    }

    pub fn scan_resource<P: AsRef<Path>>(path: P) -> Result<FiveMResource, DextaError> {
        let path = path.as_ref();
        let canonical_path = fs::canonicalize(path)?;
        let name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown_resource")
            .to_string();

        let mut has_manifest = false;
        let mut manifest_type = "none".to_string();
        let mut manifest_content = String::new();

        let fxmanifest = canonical_path.join("fxmanifest.lua");
        let resource_lua = canonical_path.join("__resource.lua");

        if fxmanifest.exists() {
            has_manifest = true;
            manifest_type = "fxmanifest".to_string();
            manifest_content = fs::read_to_string(&fxmanifest).unwrap_or_default();
        } else if resource_lua.exists() {
            has_manifest = true;
            manifest_type = "resource".to_string();
            manifest_content = fs::read_to_string(&resource_lua).unwrap_or_default();
        }

        let mut files = Vec::new();
        let mut total_size = 0;
        let mut stream_size = 0;
        let mut meta_files = Vec::new();

        for entry in WalkDir::new(&canonical_path)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let file_path = entry.path();
            if file_path.is_file() {
                let metadata = entry.metadata()?;
                let size = metadata.len();
                total_size += size;

                let relative = file_path.strip_prefix(&canonical_path)
                    .unwrap_or(file_path)
                    .to_string_lossy()
                    .to_string()
                    .replace('\\', "/");

                let category = Self::classify_file(file_path);

                if relative.starts_with("stream/") {
                    stream_size += size;
                }

                if file_path.extension().map_or(false, |ext| ext == "meta") {
                    meta_files.push(relative.clone());
                }

                files.push(ScannedFile {
                    name: file_path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                    path: file_path.to_string_lossy().to_string().replace('\\', "/"),
                    relative_path: relative,
                    size,
                    category,
                });
            }
        }

        Ok(FiveMResource {
            name,
            path: canonical_path.to_string_lossy().to_string().replace('\\', "/"),
            has_manifest,
            manifest_type,
            manifest_content,
            files,
            total_size,
            stream_size,
            meta_files,
        })
    }

    pub fn scan_collection<P: AsRef<Path>>(path: P) -> Result<Vec<FiveMResource>, DextaError> {
        let path = path.as_ref();
        let mut resources = Vec::new();

        if !path.exists() || !path.is_dir() {
            return Ok(resources);
        }

        // Direct subdirectories of collection
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            let entry_path = entry.path();
            if entry_path.is_dir() {
                // If it contains a manifest or contains stream/data/yft/ytd, treat as FiveM resource
                let is_res = entry_path.join("fxmanifest.lua").exists() 
                    || entry_path.join("__resource.lua").exists()
                    || entry_path.join("stream").exists()
                    || entry_path.join("data").exists();
                
                if is_res {
                    if let Ok(res) = Self::scan_resource(&entry_path) {
                        resources.push(res);
                    }
                }
            }
        }

        Ok(resources)
    }
}
