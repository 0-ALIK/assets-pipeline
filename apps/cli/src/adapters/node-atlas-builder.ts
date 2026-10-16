import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import Aseprite from 'ase-parser';
import sharp from 'sharp';
import { PipelineError, type AtlasBuildPlan } from '@assets-pipeline/core';

interface RawImage {
  readonly width: number;
  readonly height: number;
  readonly data: Buffer;
}

function alphaComposite(
  target: Buffer,
  targetIndex: number,
  source: Buffer,
  sourceIndex: number,
  opacity: number,
): void {
  const sourceAlpha = (source[sourceIndex + 3]! / 255) * opacity;
  if (sourceAlpha === 0) return;
  const targetAlpha = target[targetIndex + 3]! / 255;
  const outputAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
  for (let channel = 0; channel < 3; channel += 1) {
    const sourceValue = source[sourceIndex + channel]! / 255;
    const targetValue = target[targetIndex + channel]! / 255;
    target[targetIndex + channel] = Math.round(
      ((sourceValue * sourceAlpha + targetValue * targetAlpha * (1 - sourceAlpha)) / outputAlpha) *
        255,
    );
  }
  target[targetIndex + 3] = Math.round(outputAlpha * 255);
}

async function decodePng(path: string): Promise<RawImage> {
  const result = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (result.info.channels !== 4) {
    throw new PipelineError('INVALID_SOURCE', `No se pudo convertir ${path} a RGBA.`);
  }
  return { width: result.info.width, height: result.info.height, data: result.data };
}

async function decodeAseprite(path: string): Promise<RawImage> {
  const contents = await readFile(path);
  let file: Aseprite;
  try {
    file = new Aseprite(contents, path);
    file.parse();
  } catch (error) {
    throw new PipelineError(
      'INVALID_SOURCE',
      `No se pudo decodificar ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (file.colorDepth !== 32) {
    throw new PipelineError(
      'INVALID_SOURCE',
      `${path} usa ${file.colorDepth} bits; build admite Aseprite RGBA de 32 bits.`,
    );
  }
  const frame = file.frames[0];
  if (!frame) throw new PipelineError('INVALID_SOURCE', `${path} no contiene frames.`);
  const output = Buffer.alloc(file.width * file.height * 4);
  const cels = [...frame.cels].sort(
    (left, right) =>
      left.layerIndex + left.zIndex - (right.layerIndex + right.zIndex) ||
      left.zIndex - right.zIndex,
  );
  for (const cel of cels) {
    const layer = file.layers[cel.layerIndex];
    if (!layer || !layer.flags.visible || cel.opacity === 0) continue;
    if (layer.blendMode !== 0) {
      throw new PipelineError(
        'INVALID_SOURCE',
        `${path} usa un modo de mezcla Aseprite no soportado en la capa ${layer.name}.`,
      );
    }
    if (cel.celType === 3) {
      throw new PipelineError('INVALID_SOURCE', `${path} contiene un tilemap no soportado.`);
    }
    if (cel.rawCelData.length !== cel.w * cel.h * 4) {
      throw new PipelineError('INVALID_SOURCE', `Datos de cel inválidos en ${path}.`);
    }
    const opacity = (cel.opacity / 255) * (layer.opacity / 255);
    for (let y = 0; y < cel.h; y += 1) {
      const targetY = cel.ypos + y;
      if (targetY < 0 || targetY >= file.height) continue;
      for (let x = 0; x < cel.w; x += 1) {
        const targetX = cel.xpos + x;
        if (targetX < 0 || targetX >= file.width) continue;
        alphaComposite(
          output,
          (targetY * file.width + targetX) * 4,
          cel.rawCelData,
          (y * cel.w + x) * 4,
          opacity,
        );
      }
    }
  }
  return { width: file.width, height: file.height, data: output };
}

async function decodeSource(root: string, path: string): Promise<RawImage> {
  const absolute = join(root, ...path.split('/'));
  return path.toLowerCase().endsWith('.png') ? decodePng(absolute) : decodeAseprite(absolute);
}

function copySprite(
  source: RawImage,
  target: Buffer,
  targetSize: number,
  placement: AtlasBuildPlan['pages'][number]['sprites'][number],
): void {
  const rect = placement.source;
  if (rect.x + rect.width > source.width || rect.y + rect.height > source.height) {
    throw new PipelineError(
      'INVALID_SOURCE',
      `La región de ${placement.id} ya no cabe en su archivo.`,
    );
  }
  for (let y = 0; y < rect.height; y += 1) {
    const sourceStart = ((rect.y + y) * source.width + rect.x) * 4;
    const targetStart = ((placement.y + y) * targetSize + placement.x) * 4;
    source.data.copy(target, targetStart, sourceStart, sourceStart + rect.width * 4);
  }
}

function buildPageMetadata(page: AtlasBuildPlan['pages'][number]): object {
  const sprites = Object.fromEntries(
    page.sprites
      .map(
        (sprite) =>
          [
            sprite.id,
            {
              x: sprite.x,
              y: sprite.y,
              width: sprite.width,
              height: sprite.height,
              pivot: sprite.pivot,
            },
          ] as const,
      )
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  const animations = Object.fromEntries(
    page.animations
      .map(({ id, playback, frames }) => [id, { playback, frames }] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
  return { sprites, animations };
}

async function checkedOutput(root: string, requested: string): Promise<string> {
  const output = isAbsolute(requested) ? resolve(requested) : resolve(root, requested);
  const rel = relative(root, output);
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new PipelineError('INVALID_INPUT', 'La salida debe ser una subcarpeta del repositorio.');
  }
  if (rel.split(sep).some((segment) => segment.toLowerCase() === '.assets-pipeline-cache')) {
    throw new PipelineError(
      'INVALID_INPUT',
      'La salida no puede estar dentro de la carpeta interna.',
    );
  }
  let current = root;
  for (const segment of rel.split(sep)) {
    current = join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new PipelineError(
          'INVALID_INPUT',
          'La salida no puede atravesar enlaces simbólicos.',
        );
      }
    } catch (error) {
      if (!(
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      )) {
        throw error;
      }
    }
  }
  return output;
}

export async function buildAtlases(
  root: string,
  outputOption: string,
  plan: AtlasBuildPlan,
): Promise<{ output: string; files: readonly string[] }> {
  const output = await checkedOutput(root, outputOption);
  const parent = resolve(output, '..');
  await mkdir(parent, { recursive: true });
  try {
    const existing = await readdir(output);
    if (existing.length > 0 && !existing.includes('.assets-pipeline-build')) {
      throw new PipelineError(
        'ALREADY_EXISTS',
        `La salida existe y no pertenece a Assets Pipeline: ${output}`,
      );
    }
  } catch (error) {
    if (!(
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    )) {
      throw error;
    }
  }
  const temporary = join(parent, `.assets-pipeline-build-${randomUUID()}`);
  const backup = join(parent, `.assets-pipeline-backup-${randomUUID()}`);
  await mkdir(temporary);
  const decoded = new Map<string, RawImage>();
  const files: string[] = [];
  try {
    for (const page of plan.pages) {
      const raw = Buffer.alloc(page.size * page.size * 4);
      for (const sprite of page.sprites) {
        let source = decoded.get(sprite.sourcePath);
        if (!source) {
          source = await decodeSource(root, sprite.sourcePath);
          decoded.set(sprite.sourcePath, source);
        }
        copySprite(source, raw, page.size, sprite);
      }
      const png = await sharp(raw, {
        raw: { width: page.size, height: page.size, channels: 4 },
      })
        .png()
        .toBuffer();
      await writeFile(join(temporary, page.fileName), png);
      const metadataFile = `${page.fileName.slice(0, -4)}.json`;
      await writeFile(
        join(temporary, metadataFile),
        `${JSON.stringify(buildPageMetadata(page), null, 2)}\n`,
      );
      files.push(page.fileName, metadataFile);
    }
    await writeFile(join(temporary, 'index.json'), `${JSON.stringify(plan.index, null, 2)}\n`);
    await writeFile(join(temporary, '.assets-pipeline-build'), 'generated\n');
    files.push('index.json');
    let hadOutput = false;
    try {
      await rename(output, backup);
      hadOutput = true;
    } catch (error) {
      if (!(
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      )) {
        throw error;
      }
    }
    try {
      await rename(temporary, output);
    } catch (error) {
      if (hadOutput) await rename(backup, output);
      throw error;
    }
    if (hadOutput) await rm(backup, { recursive: true, force: true });
    return { output, files };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
