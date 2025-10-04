use std::path::PathBuf;

use thiserror::Error;

pub type Result<T> = std::result::Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Path is empty")]
    EmptyPath,
    #[error("Path is too long: {length} characters (max {max})")]
    PathTooLong { length: usize, max: usize },
    #[error("Path contains invalid traversal: {0}")]
    InvalidTraversal(String),
    #[error("Unsupported file extension for path: {0}")]
    UnsupportedExtension(String),
    #[error("File is too large: {path} ({size} bytes, max {max})")]
    FileTooLarge { path: String, size: u64, max: u64 },
    #[error("I/O error for {path}: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("Failed to serialize data: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl AppError {
    pub fn io(path: impl Into<PathBuf>, error: std::io::Error) -> Self {
        Self::Io {
            path: path.into().display().to_string(),
            source: error,
        }
    }
}

pub fn map_error<T>(result: Result<T>) -> std::result::Result<T, String> {
    result.map_err(|err| err.to_string())
}
