import type { AssetImporter, ImportedAsset, ImportRequest } from '@assets-pipeline/core';
import { renderSourceImage } from './images.js';

function isSupportedSource(sourcePath: string): boolean {
  return /\.(png|aseprite)$/i.test(sourcePath);
}

/**
 * Decodes PNG and Aseprite sources for Core workflows that need pixels. Rust
 * renders the first frame to PNG and the webview reads it back as straight RGBA.
 */
class TauriSourceImporter implements AssetImporter {
  readonly format = 'tauri-image';

  constructor(private readonly root: string) {}

  canImport(sourcePath: string): boolean {
    return isSupportedSource(sourcePath);
  }

  async import(request: ImportRequest): Promise<ImportedAsset> {
    const bitmap = await renderSourceImage(this.root, request.sourcePath);
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error(`No se pudo decodificar ${request.sourcePath}.`);
      context.drawImage(bitmap, 0, 0);
      const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
      return {
        kind: 'image',
        metadata: { width: bitmap.width, height: bitmap.height, format: 'rgba' },
        payload: new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength),
      };
    } finally {
      bitmap.close();
    }
  }
}

/** Importers backed by Tauri commands, injected into the Core workspace. */
export function createTauriImporters(root: string): readonly AssetImporter[] {
  return [new TauriSourceImporter(root)];
}
