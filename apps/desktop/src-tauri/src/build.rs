use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::repository::{canonical_root, resolve_relative, token, CommandError, CACHE_DIR};

const BUILD_MARKER: &str = ".assets-pipeline-build";

/// Mirrors the Core `AtlasBuildPlan`: layout decisions come from Core, pixel work happens here.
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BuildPlan {
    pages: Vec<PagePlan>,
    index: BTreeMap<String, String>,
}

#[allow(dead_code)]
#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PagePlan {
    atlas: String,
    page: u32,
    file_name: String,
    size: u32,
    gap: u32,
    sprites: Vec<Placement>,
    animations: Vec<AnimationPlan>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Placement {
    id: String,
    source_path: String,
    source: SourceRect,
    pivot: Pivot,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SourceRect {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

#[derive(Deserialize, Serialize, Clone)]
struct Pivot {
    x: f64,
    y: f64,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AnimationPlan {
    id: String,
    playback: String,
    frames: Vec<FramePlan>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FramePlan {
    sprite: String,
    duration_ms: u32,
}

#[derive(Serialize)]
pub struct BuildResult {
    output: String,
    files: Vec<String>,
}

/// Validates the output folder with the same rules as the CLI.
fn checked_output(root: &Path, requested: &str) -> Result<PathBuf, CommandError> {
    let requested_path = Path::new(requested);
    if requested_path.as_os_str().is_empty() {
        return Err(CommandError::invalid("Indica una carpeta de salida."));
    }
    let output = if requested_path.is_absolute() {
        requested_path.to_path_buf()
    } else {
        root.join(requested_path)
    };
    if output
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(CommandError::invalid("La salida no puede contener «..»."));
    }
    let relative = output.strip_prefix(root).map_err(|_| {
        CommandError::invalid("La salida debe ser una subcarpeta del repositorio.")
    })?;
    if relative.as_os_str().is_empty() {
        return Err(CommandError::invalid(
            "La salida no puede ser la raíz del repositorio.",
        ));
    }

    let mut current = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(part) = component else {
            return Err(CommandError::invalid(
                "La salida debe ser una subcarpeta del repositorio.",
            ));
        };
        if part.to_string_lossy().eq_ignore_ascii_case(CACHE_DIR) {
            return Err(CommandError::invalid(
                "La salida no puede estar dentro de la carpeta interna.",
            ));
        }
        current.push(part);
        if let Ok(metadata) = fs::symlink_metadata(&current) {
            if metadata.file_type().is_symlink() {
                return Err(CommandError::invalid(
                    "La salida no puede atravesar enlaces simbólicos.",
                ));
            }
        }
    }
    Ok(output)
}

/// Decodes (and caches) a source file as RGBA. Aseprite uses its first frame.
fn ensure_source(
    root: &Path,
    path: &str,
    cache: &mut HashMap<String, image::RgbaImage>,
) -> Result<(), CommandError> {
    if cache.contains_key(path) {
        return Ok(());
    }
    let absolute = resolve_relative(root, path)?;
    let lower = path.to_ascii_lowercase();
    let image = if lower.ends_with(".png") {
        image::open(&absolute)
            .map_err(|error| {
                CommandError::invalid_source(format!("No se pudo decodificar {path}: {error}"))
            })?
            .to_rgba8()
    } else if lower.ends_with(".aseprite") {
        let file = asefile::AsepriteFile::read_file(&absolute).map_err(|error| {
            CommandError::invalid_source(format!("No se pudo decodificar {path}: {error}"))
        })?;
        if file.num_frames() == 0 {
            return Err(CommandError::invalid_source(format!(
                "{path} no contiene frames."
            )));
        }
        file.frame(0).image()
    } else {
        return Err(CommandError::invalid_source(format!(
            "Formato de archivo no admitido: {path}"
        )));
    };
    cache.insert(path.to_string(), image);
    Ok(())
}

fn copy_sprite(
    source: &image::RgbaImage,
    target: &mut image::RgbaImage,
    placement: &Placement,
) -> Result<(), CommandError> {
    let (source_width, source_height) = source.dimensions();
    let rect = &placement.source;
    if rect.x + rect.width > source_width || rect.y + rect.height > source_height {
        return Err(CommandError::invalid_source(format!(
            "La región de {} ya no cabe en su archivo.",
            placement.id
        )));
    }
    let (target_width, target_height) = target.dimensions();
    if placement.x + placement.width > target_width
        || placement.y + placement.height > target_height
    {
        return Err(CommandError::invalid(
            "El plan coloca sprites fuera de la página.",
        ));
    }
    for y in 0..rect.height {
        for x in 0..rect.width {
            let pixel = *source.get_pixel(rect.x + x, rect.y + y);
            target.put_pixel(placement.x + x, placement.y + y, pixel);
        }
    }
    Ok(())
}

/// Page metadata identical to the CLI builder (sorted keys, no atlas field).
fn page_metadata(page: &PagePlan) -> serde_json::Value {
    let mut sprites: BTreeMap<&str, serde_json::Value> = BTreeMap::new();
    for sprite in &page.sprites {
        sprites.insert(
            &sprite.id,
            json!({
                "x": sprite.x,
                "y": sprite.y,
                "width": sprite.width,
                "height": sprite.height,
                "pivot": { "x": sprite.pivot.x, "y": sprite.pivot.y },
            }),
        );
    }
    let mut animations: BTreeMap<&str, serde_json::Value> = BTreeMap::new();
    for animation in &page.animations {
        animations.insert(
            &animation.id,
            json!({
                "playback": animation.playback,
                "frames": animation
                    .frames
                    .iter()
                    .map(|frame| json!({
                        "sprite": frame.sprite,
                        "durationMs": frame.duration_ms,
                    }))
                    .collect::<Vec<_>>(),
            }),
        );
    }
    json!({ "sprites": sprites, "animations": animations })
}

fn json_error(error: serde_json::Error) -> CommandError {
    CommandError::new("IO_ERROR", error.to_string())
}

/// Renders every planned page, writes metadata and publishes the output atomically.
#[tauri::command]
pub fn build_atlases(
    root: String,
    output: String,
    plan: BuildPlan,
) -> Result<BuildResult, CommandError> {
    let root = canonical_root(&root)?;
    let output_path = checked_output(&root, &output)?;
    let parent = output_path
        .parent()
        .ok_or_else(|| CommandError::invalid("Ruta de salida inválida."))?
        .to_path_buf();
    fs::create_dir_all(&parent)?;

    if output_path.exists() {
        if !output_path.is_dir() {
            return Err(CommandError::invalid("La salida existe y no es una carpeta."));
        }
        let has_entries = fs::read_dir(&output_path)?.next().is_some();
        if has_entries && !output_path.join(BUILD_MARKER).is_file() {
            return Err(CommandError::already_exists(format!(
                "La salida existe y no pertenece a Assets Pipeline: {}",
                output_path.display()
            )));
        }
    }

    let temporary = parent.join(format!(".assets-pipeline-build-{}", token()));
    let backup = parent.join(format!(".assets-pipeline-backup-{}", token()));
    fs::create_dir_all(&temporary)?;

    let mut decoded: HashMap<String, image::RgbaImage> = HashMap::new();
    let mut files: Vec<String> = Vec::new();
    let built = (|| -> Result<(), CommandError> {
        for page in &plan.pages {
            let mut buffer = image::RgbaImage::new(page.size, page.size);
            for placement in &page.sprites {
                ensure_source(&root, &placement.source_path, &mut decoded)?;
                let source = decoded
                    .get(&placement.source_path)
                    .expect("source decoded above");
                copy_sprite(source, &mut buffer, placement)?;
            }
            buffer.save(temporary.join(&page.file_name)).map_err(|error| {
                CommandError::new(
                    "IO_ERROR",
                    format!("No se pudo escribir {}: {error}", page.file_name),
                )
            })?;
            let metadata_name = format!("{}.json", page.file_name.trim_end_matches(".png"));
            let metadata = serde_json::to_string_pretty(&page_metadata(page)).map_err(json_error)?;
            fs::write(temporary.join(&metadata_name), format!("{metadata}\n"))?;
            files.push(page.file_name.clone());
            files.push(metadata_name);
        }
        let index = serde_json::to_string_pretty(&plan.index).map_err(json_error)?;
        fs::write(temporary.join("index.json"), format!("{index}\n"))?;
        fs::write(temporary.join(BUILD_MARKER), "generated\n")?;
        files.push("index.json".to_string());
        Ok(())
    })();

    if let Err(error) = built {
        let _ = fs::remove_dir_all(&temporary);
        return Err(error);
    }

    let had_output = output_path.exists();
    if had_output {
        fs::rename(&output_path, &backup)?;
    }
    if let Err(error) = fs::rename(&temporary, &output_path) {
        if had_output {
            let _ = fs::rename(&backup, &output_path);
        }
        let _ = fs::remove_dir_all(&temporary);
        return Err(error.into());
    }
    if had_output {
        let _ = fs::remove_dir_all(&backup);
    }

    Ok(BuildResult {
        output: output_path.to_string_lossy().into_owned(),
        files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!("assets-pipeline-build-test-{}", token()));
        fs::create_dir_all(&root).expect("create temp root");
        dunce::canonicalize(&root).expect("canonical temp root")
    }

    #[test]
    fn output_must_be_a_subfolder_of_the_repository() {
        let root = temporary_root();
        assert!(checked_output(&root, "dist/assets").is_ok());
        assert!(checked_output(&root, "nested/deep/out").is_ok());
        assert!(checked_output(&root, ".").is_err());
        assert!(checked_output(&root, "").is_err());
        assert!(checked_output(&root, "../outside").is_err());
        assert!(checked_output(&root, "dist/../dist").is_err());
        assert!(checked_output(&root, ".assets-pipeline-cache/out").is_err());
        fs::remove_dir_all(&root).ok();
    }

    fn sample_plan(index: &str) -> BuildPlan {
        BuildPlan {
            pages: vec![PagePlan {
                atlas: "chars".into(),
                page: 0,
                file_name: "chars_0.png".into(),
                size: 8,
                gap: 1,
                sprites: vec![Placement {
                    id: index.into(),
                    source_path: "hero.png".into(),
                    source: SourceRect {
                        x: 0,
                        y: 0,
                        width: 4,
                        height: 4,
                    },
                    pivot: Pivot { x: 0.5, y: 1.0 },
                    x: 1,
                    y: 2,
                    width: 4,
                    height: 4,
                }],
                animations: vec![AnimationPlan {
                    id: "hero/walk".into(),
                    playback: "loop".into(),
                    frames: vec![FramePlan {
                        sprite: index.into(),
                        duration_ms: 100,
                    }],
                }],
            }],
            index: [("hero/one".to_string(), "chars_0.png".to_string())]
                .into_iter()
                .collect(),
        }
    }

    #[test]
    fn builds_pages_metadata_and_index_end_to_end() {
        let root = temporary_root();
        let mut source = image::RgbaImage::new(4, 4);
        for pixel in source.pixels_mut() {
            *pixel = image::Rgba([255, 0, 0, 255]);
        }
        source.save(root.join("hero.png")).expect("write source");

        let result = build_atlases(
            root.to_string_lossy().into_owned(),
            "dist/assets".into(),
            sample_plan("hero/one"),
        )
        .expect("build succeeds");

        assert_eq!(result.files.len(), 3);
        assert!(root.join("dist/assets/chars_0.png").is_file());
        let metadata: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(root.join("dist/assets/chars_0.json")).expect("page json"),
        )
        .expect("valid json");
        assert_eq!(metadata["sprites"]["hero/one"]["x"], 1);
        assert_eq!(metadata["sprites"]["hero/one"]["y"], 2);
        assert_eq!(metadata["sprites"]["hero/one"]["pivot"]["y"], 1.0);
        assert!(metadata["sprites"]["hero/one"].get("atlas").is_none());
        assert_eq!(metadata["animations"]["hero/walk"]["playback"], "loop");
        assert_eq!(metadata["animations"]["hero/walk"]["frames"][0]["durationMs"], 100);
        let index: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(root.join("dist/assets/index.json")).expect("index json"),
        )
        .expect("valid json");
        assert_eq!(index["hero/one"], "chars_0.png");

        // An unmarked non-empty folder is never replaced.
        fs::create_dir_all(root.join("manual")).expect("manual dir");
        fs::write(root.join("manual/keep.txt"), "keep").expect("manual file");
        let refused = build_atlases(
            root.to_string_lossy().into_owned(),
            "manual".into(),
            sample_plan("hero/one"),
        );
        assert!(refused.is_err());

        // Rebuilding over a marked output succeeds.
        let rebuilt = build_atlases(
            root.to_string_lossy().into_owned(),
            "dist/assets".into(),
            sample_plan("hero/one"),
        );
        assert!(rebuilt.is_ok());
        fs::remove_dir_all(&root).ok();
    }
}
