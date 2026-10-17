import { PipelineError } from '../../domain/errors.js';
import { assertSourcePath, isSupportedSource } from '../../domain/value-objects/source-path.js';
import type { UseCaseContext } from '../context.js';
import type { PathChangePlan } from '../dto/repository-dto.js';
import { readRepository } from './change-repository.js';

export interface PlanPathChangeInput {
  readonly path: string;
  readonly to?: string;
}

/**
 * Computes what a move or removal would touch: affected definitions, files and
 * the parent directories a move would need to create. Never mutates anything.
 */
export async function planPathChange(
  context: UseCaseContext,
  input: PlanPathChangeInput,
): Promise<PathChangePlan> {
  const { path, to } = input;
  assertSourcePath(path);
  if (to) assertSourcePath(to);
  const kind = await context.files.kind(path);
  if (!kind) throw new PipelineError('NOT_FOUND', `Ruta no encontrada: ${path}`);
  if (kind === 'file' && !isSupportedSource(path)) {
    throw new PipelineError('INVALID_INPUT', 'Solo se administran archivos PNG y Aseprite.');
  }
  if (to) {
    if (to === path || (kind === 'directory' && to.startsWith(`${path}/`))) {
      throw new PipelineError('INVALID_INPUT', 'No se puede mover una carpeta dentro de sí misma.');
    }
    if (await context.files.kind(to)) {
      throw new PipelineError('ALREADY_EXISTS', `El destino ya existe: ${to}`);
    }
    if (
      kind === 'file' &&
      path.slice(path.lastIndexOf('.')).toLowerCase() !==
        to.slice(to.lastIndexOf('.')).toLowerCase()
    ) {
      throw new PipelineError('INVALID_INPUT', 'El destino debe conservar el formato del archivo.');
    }
  }

  const directoriesToCreate: string[] = [];
  if (to) {
    const segments = to.split('/');
    for (let length = 1; length < segments.length; length += 1) {
      const parent = segments.slice(0, length).join('/');
      const parentKind = await context.files.kind(parent);
      if (parentKind === 'file') {
        throw new PipelineError('INVALID_INPUT', `El padre del destino es un archivo: ${parent}`);
      }
      if (!parentKind) directoriesToCreate.push(parent);
    }
  }

  const repository = await readRepository(context);
  const files =
    kind === 'file'
      ? [path]
      : (await context.files.list())
          .filter((entry) => entry.kind !== 'directory' && entry.path.startsWith(`${path}/`))
          .map((entry) => entry.path);
  const definitions = repository.sourcePaths.filter(
    (key) => key === path || (kind === 'directory' && key.startsWith(`${path}/`)),
  );
  if (to) {
    for (const sourcePath of definitions) {
      const destination = `${to}${sourcePath.slice(path.length)}`;
      if (repository.source(destination) && !definitions.includes(destination)) {
        throw new PipelineError(
          'ALREADY_EXISTS',
          `El destino ya tiene definiciones: ${destination}`,
        );
      }
    }
  }
  return { from: path, ...(to ? { to } : {}), kind, definitions, files, directoriesToCreate };
}
