import {
  RepositoryWorkspace,
  createJsonRepositoryStore,
  validateRepositoryDatabase,
} from '@assets-pipeline/core';
import { call } from './commands.js';
import { TauriManagedFiles } from './managed-files.js';

/** Reads and writes `.assets-pipeline-cache/db.json` through atomic Rust commands. */
export function createTauriWorkspace(root: string): RepositoryWorkspace {
  const store = createJsonRepositoryStore({
    databasePath: `${root}/.assets-pipeline-cache/db.json`,
    fileSystem: {
      // The Tauri commands resolve the database from the repository root, so the
      // database path is informational only for this adapter.
      readText: () => call<string | null>('read_database', { root }),
      writeTextAtomically: (_path, contents) =>
        call<void>('write_database', { root, contents }),
    },
    validate: validateRepositoryDatabase,
  });
  return new RepositoryWorkspace({
    store,
    files: new TauriManagedFiles(root),
    now: () => new Date().toISOString(),
  });
}

/** Walks up from `start` looking for a repository root. */
export function findRepositoryRoot(start: string): Promise<string | null> {
  return call<string | null>('find_repository', { start });
}

export function canonicalPath(path: string): Promise<string> {
  return call<string>('canonicalize', { path });
}

export function isRealDirectory(path: string): Promise<boolean> {
  return call<boolean>('is_real_directory', { path });
}
