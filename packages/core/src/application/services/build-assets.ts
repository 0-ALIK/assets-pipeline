import { planAtlasBuild } from '../../builders/packing/pack-atlases.js';
import { PipelineError } from '../../domain/errors.js';
import type { BuildArtifact } from '../../ports/asset-builder.js';
import type { UseCaseContext } from '../context.js';
import { readRepository } from './change-repository.js';

/** Decoded RGBA pixels of one source file, ready for an AssetBuilder. */
export interface ImportedSource {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export interface BuildAssetsInput {
  readonly output?: string;
}

/**
 * Runs the deterministic build workflow: plan the atlas pages with the domain
 * planner, decode every source through the injected importers and let the
 * injected builder render the artifacts. Publishing them is the host's job.
 */
export async function buildAssets(
  context: UseCaseContext,
  input: BuildAssetsInput = {},
): Promise<readonly BuildArtifact[]> {
  const repository = await readRepository(context);
  const plan = planAtlasBuild(repository.toJSON());
  const sourcePaths = [
    ...new Set(plan.pages.flatMap((page) => page.sprites.map((sprite) => sprite.sourcePath))),
  ].sort((left, right) => left.localeCompare(right));

  const sources = new Map<string, ImportedSource>();
  for (const path of sourcePaths) {
    const importer = context.importers?.find((candidate) => candidate.canImport(path));
    if (!importer) {
      throw new PipelineError('INVALID_INPUT', `No hay importador para ${path}.`);
    }
    const imported = await importer.import({ sourcePath: path });
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
        `El importador de ${path} no informó dimensiones válidas.`,
      );
    }
    sources.set(path, { width, height, data: imported.payload });
  }

  if (!context.builder) {
    throw new PipelineError('INVALID_INPUT', 'No hay constructor de atlas configurado.');
  }
  return context.builder.build({
    assetIds: Object.keys(plan.index),
    options: {
      plan,
      sources,
      ...(input.output === undefined ? {} : { output: input.output }),
    },
  });
}
