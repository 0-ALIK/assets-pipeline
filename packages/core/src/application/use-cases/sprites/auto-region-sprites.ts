import type { Repository } from '../../../domain/entities/repository.js';
import { PipelineError } from '../../../domain/errors.js';
import type { Pivot, Rectangle } from '../../../domain/repository.js';
import { assertSourcePath, isSupportedSource } from '../../../domain/value-objects/source-path.js';
import type { UseCaseContext } from '../../context.js';
import { detectContentRegions } from '../../services/content-regions.js';
import { changeRepository, readRepository } from '../../services/change-repository.js';

export interface AutoRegionSpritesInput {
  readonly path: string;
  /** Extra pixels around every detected box. Defaults to 0. */
  readonly padding?: number;
  /** Computes the plan without writing anything. */
  readonly dryRun?: boolean;
}

export interface AutoRegionSprite {
  readonly id: string;
  readonly rect: Rectangle;
  readonly pivot: Pivot;
}

export interface AutoRegionPlan {
  readonly group: string;
  readonly sprites: readonly AutoRegionSprite[];
  /** Content islands discarded because they collided with an existing region. */
  readonly skipped: number;
}

const defaultPivot: Pivot = { x: 0.5, y: 1 };

function nextAutoGroup(repository: Repository): string {
  const groups = new Set(repository.listGroups().map((group) => group.name));
  if (!groups.has('auto')) return 'auto';
  let index = 0;
  while (groups.has(`auto_${index}`)) index += 1;
  return `auto_${index}`;
}

/**
 * Creates one region per content island of a source file. It intentionally
 * ignores the meaning of the artwork: loose parts, shadows or stray pixels all
 * become regions. Definitions that already exist are preserved and never
 * overlapped; content covered by them is skipped.
 */
export async function autoRegionSprites(
  context: UseCaseContext,
  input: AutoRegionSpritesInput,
): Promise<AutoRegionPlan> {
  assertSourcePath(input.path);
  if (!isSupportedSource(input.path)) {
    throw new PipelineError('INVALID_INPUT', 'Solo se admiten PNG y Aseprite.');
  }
  const padding = input.padding ?? 0;
  if (!Number.isInteger(padding) || padding < 0) {
    throw new PipelineError('INVALID_INPUT', 'El padding debe ser un entero desde 0.');
  }

  const repository = await readRepository(context);
  const source = repository.source(input.path);
  const occupied = source
    ? source.spriteIds.map((id) => {
        const sprite = source.sprite(id)!;
        return { x: sprite.x, y: sprite.y, width: sprite.width, height: sprite.height };
      })
    : [];

  const importer = context.importers?.find((candidate) => candidate.canImport(input.path));
  if (!importer) {
    throw new PipelineError('INVALID_INPUT', `No hay importador para ${input.path}.`);
  }
  const imported = await importer.import({ sourcePath: input.path });
  const { width, height } = imported.metadata;
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new PipelineError(
      'INVALID_SOURCE',
      `El importador de ${input.path} no informó dimensiones válidas.`,
    );
  }
  if (imported.payload.length !== width * height * 4) {
    throw new PipelineError('INVALID_SOURCE', `Píxeles RGBA inválidos para ${input.path}.`);
  }

  const { regions, skipped } = detectContentRegions({
    width,
    height,
    data: imported.payload,
    occupied,
    padding,
  });
  const group = nextAutoGroup(repository);
  const sprites = regions.map((rect, index) => ({
    id: `${group}/${index + 1}`,
    rect,
    pivot: { ...defaultPivot },
  }));

  if (!input.dryRun && sprites.length > 0) {
    await changeRepository(context, (current) => {
      for (const sprite of sprites) {
        current.addSprite(input.path, sprite.id, sprite.rect, sprite.pivot);
      }
    });
  }

  return { group, sprites, skipped };
}
