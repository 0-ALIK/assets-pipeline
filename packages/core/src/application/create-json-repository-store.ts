import type { RepositoryDatabase } from '../domain/repository.js';
import type { RepositoryStore, RepositoryStoreOptions } from '../ports/repository-store.js';
import { PipelineError } from '../domain/errors.js';

/** Creates a JSON repository adapter using filesystem behavior supplied by the host app. */
export function createJsonRepositoryStore(options: RepositoryStoreOptions): RepositoryStore {
  return {
    async read(): Promise<RepositoryDatabase | null> {
      const contents = await options.fileSystem.readText(options.databasePath);
      if (contents === null) return null;

      let parsed: unknown;
      try {
        parsed = JSON.parse(contents) as unknown;
      } catch {
        throw new PipelineError('INVALID_REPOSITORY', 'db.json contiene JSON inválido.');
      }
      return options.validate(parsed);
    },

    async write(database: RepositoryDatabase): Promise<void> {
      const validated = options.validate(database);
      await options.fileSystem.writeTextAtomically(
        options.databasePath,
        `${JSON.stringify(validated, null, 2)}\n`,
      );
    },
  };
}
