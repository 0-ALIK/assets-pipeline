import { isSupportedSource } from '../../../domain/value-objects/source-path.js';
import type { UseCaseContext } from '../../context.js';
import type { ListedFile } from '../../dto/repository-dto.js';
import { readRepository } from '../../services/change-repository.js';

/**
 * Lists the repository entries with their definition status:
 * `defined`, `undefined`, `missing` or `other`.
 */
export async function listFiles(context: UseCaseContext): Promise<readonly ListedFile[]> {
  const repository = await readRepository(context);
  const entries = await context.files.list();
  const listed: ListedFile[] = entries.map((entry) => ({
    ...entry,
    status:
      entry.kind !== 'file'
        ? 'other'
        : repository.source(entry.path)
          ? 'defined'
          : isSupportedSource(entry.path)
            ? 'undefined'
            : 'other',
  }));
  const present = new Set(entries.map((entry) => entry.path));
  for (const path of repository.sourcePaths) {
    if (!present.has(path)) listed.push({ path, kind: 'file', status: 'missing' });
  }
  return listed.sort((left, right) => left.path.localeCompare(right.path));
}
