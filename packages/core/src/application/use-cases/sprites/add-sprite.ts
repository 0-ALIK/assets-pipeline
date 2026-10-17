import { PipelineError } from '../../../domain/errors.js';
import type { Pivot, Rectangle } from '../../../domain/repository.js';
import { assertIdentifier } from '../../../domain/value-objects/identifier.js';
import { assertPivot } from '../../../domain/value-objects/pivot.js';
import { assertRectangle } from '../../../domain/value-objects/rectangle.js';
import { assertSourcePath, isSupportedSource } from '../../../domain/value-objects/source-path.js';
import type { UseCaseContext } from '../../context.js';
import { changeRepository } from '../../services/change-repository.js';

export interface AddSpriteInput {
  readonly path: string;
  readonly id: string;
  readonly rect: Rectangle;
  readonly pivot: Pivot;
}

/** Defines a sprite region inside a PNG or Aseprite source. */
export async function addSprite(context: UseCaseContext, input: AddSpriteInput): Promise<void> {
  assertSourcePath(input.path);
  assertIdentifier(input.id);
  if (!isSupportedSource(input.path)) {
    throw new PipelineError('INVALID_INPUT', 'Solo se admiten PNG y Aseprite.');
  }
  assertPivot(input.pivot);
  const size = await context.files.imageSize(input.path);
  assertRectangle(input.rect, size.width, size.height);
  await changeRepository(context, (repository) =>
    repository.addSprite(input.path, input.id, input.rect, input.pivot),
  );
}
