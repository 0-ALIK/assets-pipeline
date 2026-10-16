import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { PipelineError } from '@assets-pipeline/core';

const execFileAsync = promisify(execFile);

/** Builds the deep link the desktop app listens to: `assets-pipeline://open?repo=…`. */
export function repositoryUrl(root?: string): string {
  const url = new URL('assets-pipeline://open');
  if (root) url.searchParams.set('repo', root);
  return url.toString();
}

async function assertSchemeRegistered(): Promise<void> {
  const keys = [
    'HKCU\\Software\\Classes\\assets-pipeline',
    'HKLM\\Software\\Classes\\assets-pipeline',
  ];
  for (const key of keys) {
    try {
      await execFileAsync('reg', ['query', key], { windowsHide: true });
      return;
    } catch {
      // Try the next registry hive.
    }
  }
  throw new PipelineError(
    'NOT_FOUND',
    'La app de escritorio no está registrada para assets-pipeline://. Abre Assets Pipeline una vez (por ejemplo con `pnpm --filter @assets-pipeline/desktop tauri dev`) y vuelve a intentarlo.',
  );
}

/** Opens the desktop app on `root`, or its launcher when no repository is given. */
export async function launchDesktopApp(root?: string): Promise<string> {
  const url = repositoryUrl(root);
  try {
    if (process.platform === 'win32') {
      await assertSchemeRegistered();
      await execFileAsync('cmd', ['/c', 'start', '', url], { windowsHide: true });
    } else if (process.platform === 'darwin') {
      await execFileAsync('open', [url]);
    } else {
      await execFileAsync('xdg-open', [url]);
    }
  } catch (error) {
    if (error instanceof PipelineError) throw error;
    throw new PipelineError(
      'NOT_FOUND',
      `No se pudo abrir Assets Pipeline: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return url;
}
