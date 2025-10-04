use std::path::Path;

use chrono::{DateTime, Utc};
use serde::Serialize;
use tokio::fs;

use crate::error::{AppError, Result};
use crate::utils::path::{default_max_file_size, validate_markdown_path};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub path: String,
    pub size: u64,
    pub last_modified: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub size: u64,
    pub last_modified: DateTime<Utc>,
}

impl FileContent {
    pub fn to_metadata(&self) -> FileMetadata {
        FileMetadata {
            path: self.path.clone(),
            size: self.size,
            last_modified: self.last_modified,
        }
    }
}

pub async fn read_file(path: &str) -> Result<FileContent> {
    let path_buf = validate_markdown_path(Path::new(path))?;
    let metadata = read_metadata(&path_buf).await?;

    if metadata.size > default_max_file_size() {
        return Err(AppError::FileTooLarge {
            path: metadata.path.clone(),
            size: metadata.size,
            max: default_max_file_size(),
        });
    }

    let content = fs::read_to_string(&path_buf)
        .await
        .map_err(|err| AppError::io(&path_buf, err))?;

    Ok(FileContent {
        content,
        path: metadata.path,
        size: metadata.size,
        last_modified: metadata.last_modified,
    })
}

pub async fn write_file(path: &str, content: &str) -> Result<FileMetadata> {
    let path_buf = validate_markdown_path(Path::new(path))?;

    let parent = path_buf.parent();
    if let Some(dir) = parent {
        fs::create_dir_all(dir)
            .await
            .map_err(|err| AppError::io(dir, err))?;
    }

    let bytes = content.as_bytes();
    if bytes.len() as u64 > default_max_file_size() {
        return Err(AppError::FileTooLarge {
            path: path_buf.display().to_string(),
            size: bytes.len() as u64,
            max: default_max_file_size(),
        });
    }

    fs::write(&path_buf, bytes)
        .await
        .map_err(|err| AppError::io(&path_buf, err))?;

    read_metadata(&path_buf).await
}

pub async fn read_metadata(path: &Path) -> Result<FileMetadata> {
    let metadata = fs::metadata(path)
        .await
        .map_err(|err| AppError::io(path, err))?;

    let modified = metadata.modified().map_err(|err| AppError::io(path, err))?;
    let last_modified: DateTime<Utc> = modified.into();

    Ok(FileMetadata {
        path: path.display().to_string(),
        size: metadata.len(),
        last_modified,
    })
}
