import { PipelineError } from '../../../domain/errors.js';
import { assertRectangle } from '../../../domain/value-objects/rectangle.js';
import { assertSourcePath, isSupportedSource } from '../../../domain/value-objects/source-path.js';
import { planAtlasBuild } from '../../../builders/packing/pack-atlases.js';
import type { UseCaseContext } from '../../context.js';
import { readRepository } from '../../services/change-repository.js';

export interface ValidateRepositoryInput {
  /** Validates a single file when present; the whole repository otherwise. */
  readonly path?: string;
}

/**
 * Reports source-file issues: missing files, invalid headers, regions outside
 * the canvas and, when atlas configuration exists, build-plan problems.
 */
export async function validateRepository(
  context: UseCaseContext,
  input: ValidateRepositoryInput = {},
): Promise<readonly string[]> {
  const repository = await readRepository(context);
  const { path } = input;
  if (path) assertSourcePath(path);
  if (path && !isSupportedSource(path)) {
    throw new PipelineError('INVALID_INPUT', 'Solo se validan archivos PNG y Aseprite.');
  }
  const entries = path ? [] : await context.files.list();
  const paths = path
    ? [path]
    : [
        ...new Set([
          ...repository.sourcePaths,
          ...entries
            .filter((entry) => entry.kind === 'file' && isSupportedSource(entry.path))
            .map((entry) => entry.path),
        ]),
      ];
  const issues: string[] = [];
  for (const sourcePath of paths) {
    const source = repository.source(sourcePath);
    try {
      const size = await context.files.imageSize(sourcePath);
      for (const id of source?.spriteIds ?? []) {
        try {
          assertRectangle(source!.sprite(id)!, size.width, size.height);
        } catch {
          issues.push(`Región fuera de la imagen: ${id} (${sourcePath})`);
        }
      }
    } catch (error) {
      issues.push(`${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (!path && repository.atlasNames.length > 0) {
    try {
      planAtlasBuild(repository.toJSON());
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }
  return issues;
}
