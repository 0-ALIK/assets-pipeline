import { listen } from '@tauri-apps/api/event';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { call } from './commands.js';

export const OPEN_REPOSITORY_EVENT = 'assets-pipeline://open-repository';

export interface OpenRepositoryRequest {
  readonly repo: string | null;
}

/** Parses `assets-pipeline://open?repo=<path>` links. Pure and unit tested. */
export function repositoryFromUrl(value: string): OpenRepositoryRequest | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'assets-pipeline:') return null;
  const repo = url.searchParams.get('repo');
  return { repo: repo !== null && repo.trim() !== '' ? repo : null };
}

/**
 * Subscribes to every way the app can be asked to open a repository: the
 * deep link event, `--repo` arguments forwarded by single-instance, and the
 * request captured at startup before the webview was ready.
 */
export async function subscribeOpenRepository(
  handler: (request: OpenRepositoryRequest) => void,
): Promise<() => void> {
  const unlistenEvent = await listen<OpenRepositoryRequest>(OPEN_REPOSITORY_EVENT, (event) => {
    handler(event.payload);
  });
  const unlistenUrl = await onOpenUrl((urls) => {
    for (const value of urls) {
      const request = repositoryFromUrl(value);
      if (request) handler(request);
    }
  });
  const pending = await call<OpenRepositoryRequest | null>('take_pending_open');
  if (pending) handler(pending);
  return () => {
    unlistenEvent();
    unlistenUrl();
  };
}
