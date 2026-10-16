use std::fs;

use image::ImageEncoder as _;
use tauri::ipc::Response;

use crate::repository::{canonical_root, resolve_relative, CommandError};

/// Returns PNG bytes for a source file: `.png` files are passed through and
/// `.aseprite` files are rendered from their first frame with all visible layers.
#[tauri::command]
pub fn render_source(root: String, path: String) -> Result<Response, CommandError> {
    let root = canonical_root(&root)?;
    let absolute = resolve_relative(&root, &path)?;
    let lower = path.to_ascii_lowercase();

    if lower.ends_with(".png") {
        let bytes = fs::read(&absolute)
            .map_err(|_| CommandError::invalid_source(format!("No se pudo leer {path}.")))?;
        return Ok(Response::new(bytes));
    }
    if !lower.ends_with(".aseprite") {
        return Err(CommandError::invalid_source(format!(
            "Formato de archivo no admitido: {path}"
        )));
    }

    let file = asefile::AsepriteFile::read_file(&absolute).map_err(|error| {
        CommandError::invalid_source(format!("No se pudo decodificar {path}: {error}"))
    })?;
    if file.num_frames() == 0 {
        return Err(CommandError::invalid_source(format!(
            "{path} no contiene frames."
        )));
    }
    let image = file.frame(0).image();
    let (width, height) = image.dimensions();
    let mut bytes: Vec<u8> = Vec::new();
    image::codecs::png::PngEncoder::new(&mut bytes)
        .write_image(image.as_raw(), width, height, image::ColorType::Rgba8)
        .map_err(|error| {
            CommandError::invalid_source(format!("No se pudo renderizar {path}: {error}"))
        })?;
    Ok(Response::new(bytes))
}
