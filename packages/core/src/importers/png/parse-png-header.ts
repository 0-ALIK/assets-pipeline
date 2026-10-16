import { PipelineError } from '../../domain/errors.js';
import type { ImageSize } from '../../ports/managed-files.js';

/** Reads only PNG signature and IHDR dimensions; it does not decode pixels or check CRCs. */
export function parsePngHeader(bytes: Uint8Array, fileSize: number): ImageSize {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    fileSize < 33 ||
    bytes.length < 24 ||
    !signature.every((value, index) => bytes[index] === value)
  ) {
    throw new PipelineError('INVALID_SOURCE', 'Cabecera PNG inválida.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(8) !== 13 ||
    bytes[12] !== 73 ||
    bytes[13] !== 72 ||
    bytes[14] !== 68 ||
    bytes[15] !== 82
  ) {
    throw new PipelineError('INVALID_SOURCE', 'Chunk IHDR inválido.');
  }
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width === 0 || height === 0 || width > 0x7fffffff || height > 0x7fffffff) {
    throw new PipelineError('INVALID_SOURCE', 'Dimensiones PNG inválidas.');
  }
  return { width, height };
}
