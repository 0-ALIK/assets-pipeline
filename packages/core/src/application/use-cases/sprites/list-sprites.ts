import { PipelineError } from '../../../domain/errors.js';
import type { SpriteLocation } from '../../../domain/entities/repository.js';
import { assertSourcePath, isSupportedSource } from '../../../domain/value-objects/source-path.js';
import type { UseCaseContext } from '../../context.js';
import { readRepository } from '../../services/change-repository.js';

export interface ListSpritesInput {
  readonly path: string;
}

/** Lists the sprites defined in one source file (empty when it has none). */
export async function listSprites(
  context: UseCaseContext,
  input: ListSpritesInput,
): Promise<readonly SpriteLocation[]> {
  assertSourcePath(input.path);
  if (!isSupportedSource(input.path)) {
    throw new PipelineError('INVALID_INPUT', 'Solo se admiten PNG y Aseprite.');
  }
  const repository = await readRepository(context);
  const source = repository.source(input.path);
  if (!source) return [];
  return source.spriteIds.map((id) => ({ path: input.path, id, sprite: source.sprite(id)! }));
}
