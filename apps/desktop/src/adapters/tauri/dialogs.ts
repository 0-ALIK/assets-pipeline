import { confirm, message, open } from '@tauri-apps/plugin-dialog';

export async function pickDirectory(title: string): Promise<string | null> {
  const selection = await open({ directory: true, multiple: false, title });
  return typeof selection === 'string' ? selection : null;
}

export function askConfirmation(title: string, body: string): Promise<boolean> {
  return confirm(body, { title, kind: 'warning' });
}

export async function showNotice(title: string, body: string): Promise<void> {
  await message(body, { title, kind: 'info' });
}

export async function showError(title: string, body: string): Promise<void> {
  await message(body, { title, kind: 'error' });
}
