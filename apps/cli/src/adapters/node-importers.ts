import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Aseprite from 'ase-parser';
import sharp from 'sharp';
import { PipelineError } from '@assets-pipeline/core';
import type { AssetImporter, ImportedAsset, ImportRequest } from '@assets-pipeline/core';

/** Decoded RGBA pixels of a source file. */
export interface RawImage {
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

/** Renders the first frame of an Aseprite document, blending its visible layers. */
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

function toImported(image: RawImage): ImportedAsset {
  return {
    kind: 'image',
    metadata: { width: image.width, height: image.height, format: 'rgba' },
    payload: image.data,
  };
}

class NodePngImporter implements AssetImporter {
  readonly format = 'png';

  constructor(private readonly root: string) {}

  canImport(sourcePath: string): boolean {
    return sourcePath.toLowerCase().endsWith('.png');
  }

  async import(request: ImportRequest): Promise<ImportedAsset> {
    const absolute = join(this.root, ...request.sourcePath.split('/'));
    return toImported(await decodePng(absolute));
  }
}

class NodeAsepriteImporter implements AssetImporter {
  readonly format = 'aseprite';

  constructor(private readonly root: string) {}

  canImport(sourcePath: string): boolean {
    return sourcePath.toLowerCase().endsWith('.aseprite');
  }

  async import(request: ImportRequest): Promise<ImportedAsset> {
    const absolute = join(this.root, ...request.sourcePath.split('/'));
    return toImported(await decodeAseprite(absolute));
  }
}

/** Core importers for the formats the CLI understands. */
export function createNodeImporters(root: string): readonly AssetImporter[] {
  return [new NodePngImporter(root), new NodeAsepriteImporter(root)];
}
