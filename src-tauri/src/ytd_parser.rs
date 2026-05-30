use std::fs::File;
use std::io::Read;
use std::path::Path;
use crate::errors::DextaError;

pub struct YtdParser;

impl YtdParser {
    pub fn parse_texture_names<P: AsRef<Path>>(path: P) -> Result<Vec<String>, DextaError> {
        let mut file = File::open(path)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;

        let mut texture_names = Vec::new();
        let mut current_string = Vec::new();

        for &byte in &buffer {
            // Printable characters common in GTA V texture names
            let is_valid_char = (byte >= b'a' && byte <= b'z')
                || (byte >= b'A' && byte <= b'Z')
                || (byte >= b'0' && byte <= b'9')
                || byte == b'_'
                || byte == b'-'
                || byte == b'+'
                || byte == b'.'
                || byte == b'@';

            if is_valid_char {
                current_string.push(byte);
            } else {
                if byte == 0 && current_string.len() >= 4 && current_string.len() <= 64 {
                    if let Ok(s) = String::from_utf8(current_string.clone()) {
                        // Validate string: must contain at least one letter and not be ignored metadata
                        let has_letter = s.chars().any(|c| c.is_alphabetic());
                        if has_letter && !Self::is_ignored_metadata(&s) {
                            if !texture_names.contains(&s) {
                                texture_names.push(s);
                            }
                        }
                    }
                }
                current_string.clear();
            }
        }

        texture_names.sort();
        Ok(texture_names)
    }

    fn is_ignored_metadata(s: &str) -> bool {
        let lower = s.to_lowercase();
        matches!(
            lower.as_str(),
            "rsc7"
                | "texture"
                | "dictionary"
                | "format"
                | "dxt1"
                | "dxt5"
                | "ati2"
                | "ctx1"
                | "bc7"
                | "rgba"
                | "argb"
                | "true"
                | "false"
                | "system"
                | "graphics"
        )
    }
}
