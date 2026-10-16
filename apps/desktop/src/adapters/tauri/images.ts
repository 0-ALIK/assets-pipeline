import { call } from './commands.js';

/** Loads a PNG or Aseprite source as a decoded bitmap (PNG bytes come from Rust). */
export async function renderSourceImage(root: string, path: string): Promise<ImageBitmap> {
  const bytes = await call<ArrayBuffer | Uint8Array>('render_source', { root, path });
  const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const buffer = payload.buffer.slice(
    payload.byteOffset,
    payload.byteOffset + payload.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'image/png' });
  return createImageBitmap(blob);
}
