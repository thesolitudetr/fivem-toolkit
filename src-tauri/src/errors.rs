use serde::{Serialize, Deserialize};
use std::fmt;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", content = "message")]
pub enum DextaError {
    Io(String),
    Xml(String),
    Serialization(String),
    Validation(String),
    Conflict(String),
    Other(String),
}

impl std::error::Error for DextaError {}

impl fmt::Display for DextaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DextaError::Io(s) => write!(f, "IO Error: {}", s),
            DextaError::Xml(s) => write!(f, "XML Error: {}", s),
            DextaError::Serialization(s) => write!(f, "Serialization Error: {}", s),
            DextaError::Validation(s) => write!(f, "Validation Error: {}", s),
            DextaError::Conflict(s) => write!(f, "Conflict: {}", s),
            DextaError::Other(s) => write!(f, "Error: {}", s),
        }
    }
}

impl From<std::io::Error> for DextaError {
    fn from(err: std::io::Error) -> Self {
        DextaError::Io(err.to_string())
    }
}

impl From<quick_xml::Error> for DextaError {
    fn from(err: quick_xml::Error) -> Self {
        DextaError::Xml(err.to_string())
    }
}

impl From<quick_xml::DeError> for DextaError {
    fn from(err: quick_xml::DeError) -> Self {
        DextaError::Xml(err.to_string())
    }
}

impl From<serde_json::Error> for DextaError {
    fn from(err: serde_json::Error) -> Self {
        DextaError::Serialization(err.to_string())
    }
}

impl From<zip::result::ZipError> for DextaError {
    fn from(err: zip::result::ZipError) -> Self {
        DextaError::Io(err.to_string())
    }
}

impl From<walkdir::Error> for DextaError {
    fn from(err: walkdir::Error) -> Self {
        DextaError::Io(err.to_string())
    }
}
