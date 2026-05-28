use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::fs;
use crate::errors::DextaError;
use crate::scanner::FiveMResource;
use crate::storage::Thresholds;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalyzerWarning {
    pub file_name: String,
    pub relative_path: String,
    pub file_size: u64,
    pub threshold: u64,
    pub severity: String, // "info" | "warning" | "critical"
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamAnalysisReport {
    pub resource_name: String,
    pub path: String,
    pub total_files: usize,
    pub total_size: u64,
    pub stream_size: u64,
    pub warnings: Vec<AnalyzerWarning>,
    pub category_sizes: HashMap<String, u64>,
    pub category_counts: HashMap<String, usize>,
}

pub struct StreamAnalyzer;

impl StreamAnalyzer {
    pub fn analyze(resource: &FiveMResource, thresholds: &Thresholds) -> StreamAnalysisReport {
        let mut warnings = Vec::new();
        let mut category_sizes = HashMap::new();
        let mut category_counts = HashMap::new();

        // Initialize categories
        for cat in &["yft", "ytd", "ydd", "awc", "ymap", "ytyp", "meta", "lua", "other"] {
            category_sizes.insert(cat.to_string(), 0u64);
            category_counts.insert(cat.to_string(), 0usize);
        }

        // Check overall resource size
        if resource.total_size > thresholds.overall_resource {
            warnings.push(AnalyzerWarning {
                file_name: resource.name.clone(),
                relative_path: "".to_string(),
                file_size: resource.total_size,
                threshold: thresholds.overall_resource,
                severity: "critical".to_string(),
                message: format!(
                    "Resource overall size ({:.2} MB) exceeds safety threshold of {:.2} MB.",
                    resource.total_size as f64 / 1024.0 / 1024.0,
                    thresholds.overall_resource as f64 / 1024.0 / 1024.0
                ),
            });
        }

        for file in &resource.files {
            let cat = &file.category;
            *category_sizes.entry(cat.clone()).or_insert(0) += file.size;
            *category_counts.entry(cat.clone()).or_insert(0) += 1;

            // Size thresholds warning checks
            if file.relative_path.to_lowercase().starts_with("stream/") {
                if file.category == "ytd" && file.size > thresholds.large_ytd {
                    let severity = if file.size > thresholds.large_ytd * 2 {
                        "critical".to_string()
                    } else {
                        "warning".to_string()
                    };
                    warnings.push(AnalyzerWarning {
                        file_name: file.name.clone(),
                        relative_path: file.relative_path.clone(),
                        file_size: file.size,
                        threshold: thresholds.large_ytd,
                        severity,
                        message: format!(
                            "Texture dictionary (.ytd) size ({:.2} MB) is high. Threshold is {:.2} MB.",
                            file.size as f64 / 1024.0 / 1024.0,
                            thresholds.large_ytd as f64 / 1024.0 / 1024.0
                        ),
                    });
                } else if file.category == "yft" && file.size > thresholds.large_yft {
                    let severity = if file.size > thresholds.large_yft * 2 {
                        "critical".to_string()
                    } else {
                        "warning".to_string()
                    };
                    warnings.push(AnalyzerWarning {
                        file_name: file.name.clone(),
                        relative_path: file.relative_path.clone(),
                        file_size: file.size,
                        threshold: thresholds.large_yft,
                        severity,
                        message: format!(
                            "Vehicle model (.yft) size ({:.2} MB) is high. Threshold is {:.2} MB.",
                            file.size as f64 / 1024.0 / 1024.0,
                            thresholds.large_yft as f64 / 1024.0 / 1024.0
                        ),
                    });
                } else if file.category == "awc" && file.size > thresholds.large_awc {
                    let severity = if file.size > thresholds.large_awc * 2 {
                        "critical".to_string()
                    } else {
                        "warning".to_string()
                    };
                    warnings.push(AnalyzerWarning {
                        file_name: file.name.clone(),
                        relative_path: file.relative_path.clone(),
                        file_size: file.size,
                        threshold: thresholds.large_awc,
                        severity,
                        message: format!(
                            "Audio container (.awc) size ({:.2} MB) is high. Threshold is {:.2} MB.",
                            file.size as f64 / 1024.0 / 1024.0,
                            thresholds.large_awc as f64 / 1024.0 / 1024.0
                        ),
                    });
                }
            }
        }

        StreamAnalysisReport {
            resource_name: resource.name.clone(),
            path: resource.path.clone(),
            total_files: resource.files.len(),
            total_size: resource.total_size,
            stream_size: resource.stream_size,
            warnings,
            category_sizes,
            category_counts,
        }
    }

    pub fn export_report(report: &StreamAnalysisReport, export_path: &str, format_type: &str) -> Result<(), DextaError> {
        let content = match format_type {
            "json" => serde_json::to_string_pretty(report)?,
            "md" => Self::generate_markdown(report),
            "html" => Self::generate_html(report),
            _ => return Err(DextaError::Validation("Invalid report format".to_string())),
        };
        fs::write(export_path, content)?;
        Ok(())
    }

    fn generate_markdown(report: &StreamAnalysisReport) -> String {
        let mut md = format!(
            "# Dexta Toolkit - Stream Analysis Report\n\n- **Resource**: {}\n- **Path**: {}\n- **Total Size**: {:.2} MB\n- **Stream Size**: {:.2} MB\n- **Total Files**: {}\n\n",
            report.resource_name,
            report.path,
            report.total_size as f64 / 1024.0 / 1024.0,
            report.stream_size as f64 / 1024.0 / 1024.0,
            report.total_files
        );

        md.push_str("## Size by Category\n\n| Category | Count | Size (MB) |\n| --- | --- | --- |\n");
        let mut cats: Vec<_> = report.category_sizes.iter().collect();
        cats.sort_by(|a, b| b.1.cmp(a.1));
        for (cat, size) in cats {
            let count = report.category_counts.get(cat).unwrap_or(&0);
            md.push_str(&format!(
                "| **{}** | {} | {:.2} MB |\n",
                cat.to_uppercase(),
                count,
                *size as f64 / 1024.0 / 1024.0
            ));
        }

        md.push_str("\n## Warnings & Performance Alerts\n\n");
        if report.warnings.is_empty() {
            md.push_str("✅ No warnings detected! All asset sizes are within configured thresholds.\n");
        } else {
            md.push_str("| Severity | File / Context | Size | Message |\n| --- | --- | --- | --- |\n");
            for w in &report.warnings {
                let badge = match w.severity.as_str() {
                    "critical" => "🔴 CRITICAL",
                    "warning" => "🟡 WARNING",
                    _ => "🔵 INFO",
                };
                md.push_str(&format!(
                    "| {} | `{}` | {:.2} MB | {} |\n",
                    badge,
                    if w.relative_path.is_empty() { &w.file_name } else { &w.relative_path },
                    w.file_size as f64 / 1024.0 / 1024.0,
                    w.message
                ));
            }
        }

        md
    }

    fn generate_html(report: &StreamAnalysisReport) -> String {
        let md = Self::generate_markdown(report);
        // Simple HTML template wrapper
        format!(
            r#"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Stream Analysis - {}</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #333; }}
h1, h2 {{ color: #1e1b4b; }}
table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
th {{ background-color: #f3f4f6; }}
tr:nth-child(even) {{ background-color: #f9fafb; }}
code {{ background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; }}
</style>
</head>
<body>
{}
</body>
</html>"#,
            report.resource_name,
            md.replace("\n", "<br/>") // Very basic Markdown text rendering wrapper for simplicity, since we just need clean HTML output.
        )
    }
}
