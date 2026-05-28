use serde::{Serialize, Deserialize};
use std::fs;
use std::io::Write;
use std::path::Path;
use walkdir::WalkDir;
use crate::errors::DextaError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportResult {
    pub output_path: String,
    pub total_files: usize,
    pub total_size: u64,
    pub zip_generated: bool,
}

pub struct Exporter;

impl Exporter {
    pub fn clean_copy<P: AsRef<Path>, Q: AsRef<Path>>(src: P, dest: Q) -> Result<(usize, u64), DextaError> {
        let src = src.as_ref();
        let dest = dest.as_ref();

        let mut copied_count = 0;
        let mut total_size = 0;

        fs::create_dir_all(dest)?;

        for entry in WalkDir::new(src)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_file() {
                // Check if file is in an ignored folder
                let relative = path.strip_prefix(src).unwrap_or(path);
                let rel_str = relative.to_string_lossy().to_string().replace('\\', "/");

                // Filter out standard non-production files
                if rel_str.contains(".git/") 
                    || rel_str.contains(".gemini/")
                    || rel_str.contains("node_modules/")
                    || rel_str.contains(".vscode/")
                    || rel_str.ends_with(".zip")
                    || rel_str.ends_with(".log")
                {
                    continue;
                }

                let target_file = dest.join(relative);
                if let Some(parent) = target_file.parent() {
                    fs::create_dir_all(parent)?;
                }

                fs::copy(path, &target_file)?;
                copied_count += 1;
                total_size += entry.metadata()?.len();
            }
        }

        Ok((copied_count, total_size))
    }

    pub fn zip_folder<P: AsRef<Path>, W: Write + std::io::Seek>(src: P, writer: W) -> Result<(usize, u64), DextaError> {
        let src = src.as_ref();
        let mut zip = zip::ZipWriter::new(writer);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        let mut file_count = 0;
        let mut total_size = 0;

        for entry in WalkDir::new(src)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            let name = path.strip_prefix(src).unwrap_or(path);
            let name_str = name.to_string_lossy().to_string().replace('\\', "/");

            if name_str.is_empty() {
                continue;
            }

            if path.is_file() {
                // Filters
                if name_str.contains(".git/") 
                    || name_str.contains(".gemini/")
                    || name_str.contains("node_modules/")
                    || name_str.contains(".vscode/")
                    || name_str.ends_with(".zip")
                    || name_str.ends_with(".log")
                {
                    continue;
                }

                let metadata = entry.metadata()?;
                let size = metadata.len();
                total_size += size;
                file_count += 1;

                zip.start_file(name_str, options)?;
                let file_content = fs::read(path)?;
                zip.write_all(&file_content)?;
            } else if path.is_dir() {
                zip.add_directory(name_str, options)?;
            }
        }

        zip.finish()?;
        Ok((file_count, total_size))
    }

    pub fn export(
        src_dir: &str,
        dest_dir: &str,
        export_as_zip: bool,
    ) -> Result<ExportResult, DextaError> {
        let src_path = Path::new(src_dir);
        let dest_path = Path::new(dest_dir);

        if !src_path.exists() {
            return Err(DextaError::Validation("Source folder does not exist".to_string()));
        }

        let resource_name = src_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("exported_resource");

        if export_as_zip {
            let zip_name = format!("{}.zip", resource_name);
            let zip_path = dest_path.join(zip_name);
            if let Some(parent) = zip_path.parent() {
                fs::create_dir_all(parent)?;
            }
            let file = fs::File::create(&zip_path)?;
            let (files_count, size) = Self::zip_folder(src_path, file)?;

            Ok(ExportResult {
                output_path: zip_path.to_string_lossy().to_string().replace('\\', "/"),
                total_files: files_count,
                total_size: size,
                zip_generated: true,
            })
        } else {
            let output_folder = dest_path.join(resource_name);
            let (files_count, size) = Self::clean_copy(src_path, &output_folder)?;

            Ok(ExportResult {
                output_path: output_folder.to_string_lossy().to_string().replace('\\', "/"),
                total_files: files_count,
                total_size: size,
                zip_generated: false,
            })
        }
    }
}
