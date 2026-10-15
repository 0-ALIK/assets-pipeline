import type { RepositoryDatabase } from '../domain/repository.js';

/** Persistence boundary for a project's versioned repository database. */
export interface RepositoryStore {
  read(): Promise<RepositoryDatabase | null>;
  write(database: RepositoryDatabase): Promise<void>;
}

/** Minimal filesystem boundary used by a JSON-backed repository adapter. */
export interface RepositoryFileSystem {
  readText(path: string): Promise<string | null>;
  writeTextAtomically(path: string, contents: string): Promise<void>;
}

export interface RepositoryStoreOptions {
  readonly databasePath: string;
  readonly fileSystem: RepositoryFileSystem;
  readonly validate: (value: unknown) => RepositoryDatabase;
}
