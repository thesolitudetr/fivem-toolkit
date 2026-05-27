use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use crate::errors::DextaError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Thresholds {
    pub large_ytd: u64, // bytes
    pub large_yft: u64, // bytes
    pub large_awc: u64, // bytes
    pub overall_resource: u64, // bytes
}

impl Default for Thresholds {
    fn default() -> Self {
        Thresholds {
            large_ytd: 16 * 1024 * 1024, // 16MB
            large_yft: 16 * 1024 * 1024, // 16MB
            large_awc: 15 * 1024 * 1024, // 15MB
            overall_resource: 100 * 1024 * 1024, // 100MB
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub language: String, // "en" | "tr"
    pub default_output_dir: String,
    pub thresholds: Thresholds,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            language: "en".to_string(),
            default_output_dir: "".to_string(),
            thresholds: Thresholds::default(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentActivity {
    pub id: String,
    pub activity_type: String, // "scan" | "merge" | "fix" | "export"
    pub resource_name: String,
    pub path: String,
    pub timestamp: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentProject {
    pub name: String,
    pub path: String,
    pub resource_count: usize,
    pub total_size: u64,
    pub last_opened: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct DextaDb {
    pub settings: AppSettings,
    pub recent_activity: Vec<RecentActivity>,
    pub recent_projects: Vec<RecentProject>,
}

pub struct StorageManager {
    db_path: PathBuf,
}

impl StorageManager {
    pub fn new() -> Self {
        let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("DextaToolkit");
        let _ = fs::create_dir_all(&path);
        path.push("dexta_db.json");
        StorageManager { db_path: path }
    }

    pub fn load(&self) -> Result<DextaDb, DextaError> {
        if !self.db_path.exists() {
            let db = DextaDb::default();
            self.save(&db)?;
            return Ok(db);
        }
        let data = fs::read_to_string(&self.db_path)?;
        let db: DextaDb = serde_json::from_str(&data).unwrap_or_default();
        Ok(db)
    }

    pub fn save(&self, db: &DextaDb) -> Result<(), DextaError> {
        let serialized = serde_json::to_string_pretty(db)?;
        fs::write(&self.db_path, serialized)?;
        Ok(())
    }

    pub fn get_db_path(&self) -> String {
        self.db_path.to_string_lossy().to_string()
    }
}
