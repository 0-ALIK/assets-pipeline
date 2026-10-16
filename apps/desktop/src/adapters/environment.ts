import { isTauri } from '@tauri-apps/api/core';

/** True when the webview runs inside the Tauri shell with native commands available. */
export function isDesktopApp(): boolean {
  return isTauri();
}
