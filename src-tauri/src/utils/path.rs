use std::path::{Component, Path, PathBuf};

use crate::error::{AppError, Result};

const MAX_PATH_LENGTH: usize = 4096;
const ALLOWED_EXTENSIONS: [&str; 3] = ["md", "markdown", "mdown"];

pub fn validate_markdown_path(path: &Path) -> Result<PathBuf> {
    if path.as_os_str().is_empty() {
        return Err(AppError::EmptyPath);
    }

    let path_str = path
        .to_str()
        .ok_or_else(|| AppError::Internal("Path contains invalid UTF-8".into()))?;

    let length = path_str.len();
    if length > MAX_PATH_LENGTH {
        return Err(AppError::PathTooLong {
            length,
            max: MAX_PATH_LENGTH,
        });
    }

    if path_str.contains('\0') {
        return Err(AppError::InvalidTraversal(path_str.into()));
    }

    if path
        .components()
        .any(|component| component == Component::ParentDir)
    {
        return Err(AppError::InvalidTraversal(path_str.into()));
    }

    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase());
    if let Some(ext) = extension {
        if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
            return Err(AppError::UnsupportedExtension(path_str.into()));
        }
    } else {
        return Err(AppError::UnsupportedExtension(path_str.into()));
    }

    Ok(path.to_path_buf())
}

pub fn default_max_file_size() -> u64 {
    50 * 1024 * 1024 // 50MB
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn validates_markdown_extension() {
        let path = Path::new("/tmp/document.md");
        assert!(validate_markdown_path(path).is_ok());

        let invalid = Path::new("/tmp/document.exe");
        assert!(matches!(
            validate_markdown_path(invalid),
            Err(AppError::UnsupportedExtension(_))
        ));
    }

    #[test]
    fn rejects_parent_directory_components() {
        let path = Path::new("../secret.md");
        assert!(matches!(
            validate_markdown_path(path),
            Err(AppError::InvalidTraversal(_))
        ));
    }
}
