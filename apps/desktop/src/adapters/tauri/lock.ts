import { call } from './commands.js';

/**
 * Same lock file the CLI uses (`.assets-pipeline-cache/lock`). Mutating flows must
 * run inside this wrapper so the CLI and the app never write db.json at once.
 */
export async function withRepositoryLock<T>(root: string, action: () => Promise<T>): Promise<T> {
  await call<void>('acquire_lock', { root });
  try {
    return await action();
  } finally {
    try {
      await call<void>('release_lock', { root });
    } catch {
      // The lock may already be gone after a failed operation.
    }
  }
}
