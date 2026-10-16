import { PipelineError } from '../../domain/errors.js';
import type { ImageSize } from '../../ports/managed-files.js';

/** Reads Aseprite's 128-byte file header without decoding frames or cels. */
export function parseAsepriteHeader(bytes: Uint8Array, fileSize: number): ImageSize {
  if (fileSize < 128 || bytes.length < 14) {
    throw new PipelineError('INVALID_SOURCE', 'Cabecera Aseprite incompleta.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(4, true) !== 0xa5e0 || view.getUint16(6, true) === 0) {
    throw new PipelineError('INVALID_SOURCE', 'Cabecera Aseprite inválida.');
  }
  const width = view.getUint16(8, true);
  const height = view.getUint16(10, true);
  if (width === 0 || height === 0) {
    throw new PipelineError('INVALID_SOURCE', 'Dimensiones Aseprite inválidas.');
  }
  return { width, height };
}
