import { call } from './commands.js';

/** Loads a PNG or Aseprite source as a decoded bitmap (PNG bytes come from Rust). */
export async function renderSourceImage(root: string, path: string): Promise<ImageBitmap> {
  const bytes = await call<ArrayBuffer | Uint8Array>('render_source', { root, path });
  const blob = new Blob([bytes], { type: 'image/png' });
  return createImageBitmap(blob);
}
