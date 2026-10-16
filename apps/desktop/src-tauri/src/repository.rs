use std::fs;
use std::io::{Read as _, Write as _};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

pub const CACHE_DIR: &str = ".assets-pipeline-cache";
const BUILD_MARKER: &str = ".assets-pipeline-build";

/// Structured error surfaced to the webview. Codes mirror the Core `PipelineError` codes.
#[derive(Debug, Serialize)]
pub struct CommandError {
    code: &'static str,
    message: String,
}

impl CommandError {
    pub(crate) fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub(crate) fn invalid(message: impl Into<String>) -> Self {
        Self::new("INVALID_INPUT", message)
    }

    pub(crate) fn not_found(message: impl Into<String>) -> Self {
        Self::new("NOT_FOUND", message)
    }

    pub(crate) fn already_exists(message: impl Into<String>) -> Self {
        Self::new("ALREADY_EXISTS", message)
    }

    pub(crate) fn in_use(message: impl Into<String>) -> Self {
        Self::new("IN_USE", message)
    }

    pub(crate) fn invalid_repository(message: impl Into<String>) -> Self {
        Self::new("INVALID_REPOSITORY", message)
    }

    pub(crate) fn invalid_source(message: impl Into<String>) -> Self {
        Self::new("INVALID_SOURCE", message)
    }
}

impl From<std::io::Error> for CommandError {
    fn from(error: std::io::Error) -> Self {
        Self::new("IO_ERROR", error.to_string())
    }
}

#[derive(Serialize)]
pub struct FileEntryDto {
    path: String,
    kind: &'static str,
}

#[derive(Serialize)]
pub struct FileHeadDto {
    size: u64,
    bytes: Vec<u8>,
}

pub(crate) fn token() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_nanos())
        .unwrap_or_default();
    format!("{}-{nanos}", std::process::id())
}

#[cfg(windows)]
fn hide_on_windows(path: &Path) {
    use std::os::windows::process::CommandExt as _;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let _ = Command::new("attrib")
        .arg("+h")
        .arg(path)
        .creation_flags(CREATE_NO_WINDOW)
        .status();
}

#[cfg(not(windows))]
fn hide_on_windows(_path: &Path) {}

fn is_reserved_segment(segment: &str) -> bool {
    segment.is_empty()
        || segment == "."
        || segment == ".."
        || segment == "__proto__"
        || segment == "constructor"
        || segment == "prototype"
}

/// Validates a repository-relative path. Mirrors `assertSourcePath` from Core.
fn checked_segments(path: &str) -> Result<Vec<&str>, CommandError> {
    if path.is_empty()
        || path.starts_with('/')
        || path.contains('\\')
        || path.contains(':')
        || path.split('/').any(|segment| {
            is_reserved_segment(segment) || segment.eq_ignore_ascii_case(CACHE_DIR)
        })
    {
        return Err(CommandError::invalid(format!("Ruta inválida: {path}")));
    }
    Ok(path.split('/').collect())
}

/// Resolves a relative path below `root`, refusing symlink traversal.
pub(crate) fn resolve_relative(root: &Path, path: &str) -> Result<PathBuf, CommandError> {
    let segments = checked_segments(path)?;
    let mut current = root.to_path_buf();
    for segment in &segments {
        current.push(segment);
        match fs::symlink_metadata(&current) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    return Err(CommandError::invalid(format!(
                        "No se admiten enlaces simbólicos: {path}"
                    )));
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    Ok(current)
}

pub(crate) fn canonical_root(root: &str) -> Result<PathBuf, CommandError> {
    let canonical = dunce::canonicalize(root)
        .map_err(|_| CommandError::not_found(format!("Ruta no encontrada: {root}")))?;
    if !canonical.is_dir() {
        return Err(CommandError::invalid(format!(
            "La ruta no es una carpeta: {root}"
        )));
    }
    Ok(canonical)
}

fn assert_cache_directory(cache: &Path) -> Result<(), CommandError> {
    match fs::symlink_metadata(cache) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                Err(CommandError::invalid_repository(
                    "La carpeta interna del repositorio debe ser una carpeta real.",
                ))
            } else {
                Ok(())
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn assert_real_file(path: &Path) -> Result<(), CommandError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                Err(CommandError::invalid_repository(
                    "db.json debe ser un archivo real.",
                ))
            } else {
                Ok(())
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn ensure_cache_directory(root: &Path) -> Result<PathBuf, CommandError> {
    let cache = root.join(CACHE_DIR);
    assert_cache_directory(&cache)?;
    fs::create_dir_all(&cache)?;
    hide_on_windows(&cache);
    Ok(cache)
}

fn staged_path(root: &Path, token: &str) -> Result<PathBuf, CommandError> {
    if token.is_empty()
        || !token
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
    {
        return Err(CommandError::invalid("Token de eliminación inválido."));
    }
    Ok(root.join(CACHE_DIR).join("trash").join(token))
}

#[tauri::command]
pub fn canonicalize(path: String) -> Result<String, CommandError> {
    let canonical = dunce::canonicalize(&path)
        .map_err(|_| CommandError::not_found(format!("Ruta no encontrada: {path}")))?;
    Ok(canonical.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn is_real_directory(path: String) -> Result<bool, CommandError> {
    match fs::symlink_metadata(&path) {
        Ok(metadata) => Ok(metadata.is_dir() && !metadata.file_type().is_symlink()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}

/// Walks up from `start` looking for `.assets-pipeline-cache/db.json`.
#[tauri::command]
pub fn find_repository(start: String) -> Result<Option<String>, CommandError> {
    let mut current = dunce::canonicalize(&start)
        .map_err(|_| CommandError::not_found(format!("Ruta no encontrada: {start}")))?;
    if !current.is_dir() {
        return Err(CommandError::invalid(format!(
            "La ruta no es una carpeta: {start}"
        )));
    }
    loop {
        let cache = current.join(CACHE_DIR);
        let database = cache.join("db.json");
        if database.exists() {
            assert_cache_directory(&cache)?;
            assert_real_file(&database)?;
            return Ok(Some(current.to_string_lossy().into_owned()));
        }
        match current.parent() {
            Some(parent) => current = parent.to_path_buf(),
            None => return Ok(None),
        }
    }
}

#[tauri::command]
pub fn read_database(root: String) -> Result<Option<String>, CommandError> {
    let cache = Path::new(&root).join(CACHE_DIR);
    assert_cache_directory(&cache)?;
    let database = cache.join("db.json");
    assert_real_file(&database)?;
    match fs::read_to_string(&database) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

#[tauri::command]
pub fn write_database(root: String, contents: String) -> Result<(), CommandError> {
    let cache = ensure_cache_directory(Path::new(&root))?;
    let database = cache.join("db.json");
    assert_real_file(&database)?;
    let temporary = cache.join(format!("db.json.{}.tmp", token()));
    let result = (|| -> Result<(), CommandError> {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(contents.as_bytes())?;
        file.sync_all()?;
        Ok(())
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temporary);
        return Err(error);
    }
    match fs::rename(&temporary, &database) {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(&temporary);
            Err(error.into())
        }
    }
}

fn visit(directory: &Path, prefix: &str, entries: &mut Vec<FileEntryDto>) -> Result<(), CommandError> {
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if prefix.is_empty() && name.eq_ignore_ascii_case(CACHE_DIR) {
            continue;
        }
        let path = if prefix.is_empty() {
            name
        } else {
            format!("{prefix}/{name}")
        };
        let file_type = entry.file_type()?;
        if file_type.is_symlink() {
            entries.push(FileEntryDto {
                path,
                kind: "symlink",
            });
        } else if file_type.is_dir() {
            entries.push(FileEntryDto {
                path: path.clone(),
                kind: "directory",
            });
            // Generated build folders are listed but never traversed as sources.
            if !entry.path().join(BUILD_MARKER).exists() {
                visit(&entry.path(), &path, entries)?;
            }
        } else if file_type.is_file() {
            entries.push(FileEntryDto { path, kind: "file" });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_entries(root: String) -> Result<Vec<FileEntryDto>, CommandError> {
    let root = canonical_root(&root)?;
    let mut entries = Vec::new();
    visit(&root, "", &mut entries)?;
    Ok(entries)
}

#[tauri::command]
pub fn path_kind(root: String, path: String) -> Result<Option<String>, CommandError> {
    let root = canonical_root(&root)?;
    let absolute = resolve_relative(&root, &path)?;
    match fs::symlink_metadata(&absolute) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                Err(CommandError::invalid(format!(
                    "No se admiten enlaces simbólicos: {path}"
                )))
            } else if metadata.is_file() {
                Ok(Some("file".into()))
            } else if metadata.is_dir() {
                Ok(Some("directory".into()))
            } else {
                Err(CommandError::invalid(format!(
                    "Tipo de archivo no admitido: {path}"
                )))
            }
        }
    }
}

#[tauri::command]
pub fn make_directory(root: String, path: String) -> Result<(), CommandError> {
    let root = canonical_root(&root)?;
    let absolute = resolve_relative(&root, &path)?;
    if fs::symlink_metadata(&absolute).is_ok() {
        return Err(CommandError::already_exists(format!(
            "La ruta ya existe: {path}"
        )));
    }
    fs::create_dir_all(&absolute)?;
    Ok(())
}

#[tauri::command]
pub fn move_path(root: String, from: String, to: String) -> Result<(), CommandError> {
    let root = canonical_root(&root)?;
    let source = resolve_relative(&root, &from)?;
    if fs::symlink_metadata(&source).is_err() {
        return Err(CommandError::not_found(format!("Ruta no encontrada: {from}")));
    }
    let destination = resolve_relative(&root, &to)?;
    if fs::symlink_metadata(&destination).is_ok() {
        return Err(CommandError::already_exists(format!(
            "El destino ya existe: {to}"
        )));
    }
    let parent = destination
        .parent()
        .ok_or_else(|| CommandError::invalid("La carpeta de destino no existe."))?;
    let parent_is_directory = fs::metadata(parent)
        .map(|metadata| metadata.is_dir())
        .unwrap_or(false);
    if !parent_is_directory {
        return Err(CommandError::invalid("La carpeta de destino no existe."));
    }
    fs::rename(&source, &destination)?;
    Ok(())
}

#[tauri::command]
pub fn stage_removal(root: String, path: String) -> Result<String, CommandError> {
    let root = canonical_root(&root)?;
    let source = resolve_relative(&root, &path)?;
    fs::symlink_metadata(&source)
        .map_err(|_| CommandError::not_found(format!("Ruta no encontrada: {path}")))?;
    let trash = root.join(CACHE_DIR).join("trash");
    fs::create_dir_all(&trash)?;
    let token = token();
    let staged = staged_path(&root, &token)?;
    fs::rename(&source, &staged)?;
    Ok(token)
}

#[tauri::command]
pub fn commit_removal(root: String, token: String) -> Result<(), CommandError> {
    let root = canonical_root(&root)?;
    let staged = staged_path(&root, &token)?;
    let metadata = fs::symlink_metadata(&staged)
        .map_err(|_| CommandError::not_found("La eliminación ya no está en curso."))?;
    let result = if metadata.is_dir() {
        fs::remove_dir_all(&staged)
    } else {
        fs::remove_file(&staged)
    };
    result.map_err(|_| {
        CommandError::invalid_repository(format!(
            "La metadata se actualizó, pero quedaron archivos por eliminar en {}. Revísalos manualmente.",
            staged.display()
        ))
    })
}

#[tauri::command]
pub fn rollback_removal(root: String, token: String, path: String) -> Result<(), CommandError> {
    let root = canonical_root(&root)?;
    let staged = staged_path(&root, &token)?;
    let destination = resolve_relative(&root, &path)?;
    fs::rename(&staged, &destination)?;
    Ok(())
}

#[tauri::command]
pub fn read_file_head(root: String, path: String, length: usize) -> Result<FileHeadDto, CommandError> {
    let root = canonical_root(&root)?;
    let absolute = resolve_relative(&root, &path)?;
    let mut file = fs::File::open(&absolute)
        .map_err(|_| CommandError::not_found(format!("Ruta no encontrada: {path}")))?;
    let size = file.metadata()?.len();
    let mut bytes = vec![0_u8; length];
    let read = file.read(&mut bytes)?;
    bytes.truncate(read);
    Ok(FileHeadDto { size, bytes })
}

#[tauri::command]
pub fn acquire_lock(root: String) -> Result<(), CommandError> {
    let cache = ensure_cache_directory(Path::new(&root))?;
    let lock = cache.join("lock");
    match fs::OpenOptions::new().write(true).create_new(true).open(&lock) {
        Ok(mut file) => {
            let _ = write!(file, "{} {}", std::process::id(), token());
            Ok(())
        }
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => Err(
            CommandError::in_use("El repositorio está ocupado. Si quedó un lock tras un fallo, revísalo antes de eliminarlo."),
        ),
        Err(error) => Err(error.into()),
    }
}

#[tauri::command]
pub fn release_lock(root: String) -> Result<(), CommandError> {
    let lock = Path::new(&root).join(CACHE_DIR).join("lock");
    match fs::remove_file(&lock) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}
