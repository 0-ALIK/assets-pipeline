import { PipelineError } from '../domain/errors.js';
import {
  assertAtlasGap,
  assertAtlasName,
  assertAtlasSize,
  assertDuration,
  assertIdentifier,
  assertPivot,
  assertRectangle,
  assertSourcePath,
  isSupportedSource,
} from '../domain/rules.js';
import type {
  AnimationDefinition,
  AtlasDefinition,
  LegacyData,
  ProjectConfiguration,
  RepositoryDatabase,
  SourceDefinitions,
  SpriteDefinition,
} from '../domain/repository.js';

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new PipelineError('INVALID_REPOSITORY', `${label} debe ser un objeto.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PipelineError('INVALID_REPOSITORY', `${label} debe ser texto no vacío.`);
  }
  return value;
}

function legacyRecords(
  value: unknown,
  label: string,
): readonly Readonly<Record<string, unknown>>[] {
  if (!Array.isArray(value))
    throw new PipelineError('INVALID_REPOSITORY', `${label} debe ser una lista.`);
  return value.map((item) => record(item, label));
}

/** Deterministic migration of the original scaffold schema, preserving its unmodelled records. */
function migrateVersion1(input: Record<string, unknown>): RepositoryDatabase {
  const oldProject = record(input.project, 'project');
  if (oldProject.schemaVersion !== 1) {
    throw new PipelineError('INVALID_REPOSITORY', 'Versión de proyecto anterior inválida.');
  }
  const project: ProjectConfiguration = {
    id: string(oldProject.id, 'project.id'),
    name: string(oldProject.name, 'project.name'),
    createdAt: string(oldProject.createdAt, 'project.createdAt'),
    updatedAt: string(oldProject.updatedAt, 'project.updatedAt'),
  };
  const legacy: LegacyData = {
    assets: legacyRecords(input.assets, 'assets'),
    operationHistory: legacyRecords(input.operationHistory, 'operationHistory'),
  };
  return { schemaVersion: 4, project, sources: {}, atlases: {}, legacy };
}

function migrateVersion2(input: Record<string, unknown>): RepositoryDatabase {
  const migrated = validateVersion2(input);
  return { ...migrated, schemaVersion: 4, atlases: {} };
}

function migrateVersion3(input: Record<string, unknown>): RepositoryDatabase {
  const base = validateVersion2(input);
  const atlases = validateAtlases(input.atlases, true);
  return { schemaVersion: 4, ...base, atlases };
}

function validateVersion2(
  input: Record<string, unknown>,
): Omit<RepositoryDatabase, 'schemaVersion' | 'atlases'> {
  const rawProject = record(input.project, 'project');
  const project: ProjectConfiguration = {
    id: string(rawProject.id, 'project.id'),
    name: string(rawProject.name, 'project.name'),
    createdAt: string(rawProject.createdAt, 'project.createdAt'),
    updatedAt: string(rawProject.updatedAt, 'project.updatedAt'),
  };
  const sources = validateSources(input.sources);
  let legacy: LegacyData | undefined;
  if (input.legacy !== undefined) {
    const rawLegacy = record(input.legacy, 'legacy');
    legacy = {
      assets: legacyRecords(rawLegacy.assets, 'legacy.assets'),
      operationHistory: legacyRecords(rawLegacy.operationHistory, 'legacy.operationHistory'),
    };
  }
  return { project, sources, ...(legacy ? { legacy } : {}) };
}

function validateSources(value: unknown): Record<string, SourceDefinitions> {
  const rawSources = record(value, 'sources');
  const sources: Record<string, SourceDefinitions> = {};
  const sourceKeys = new Set<string>();
  const allSprites = new Set<string>();
  const allAnimations = new Set<string>();
  for (const [path, rawSource] of Object.entries(rawSources)) {
    assertSourcePath(path);
    const foldedPath = path.toLocaleLowerCase();
    if (sourceKeys.has(foldedPath)) {
      throw new PipelineError(
        'INVALID_REPOSITORY',
        `Rutas duplicadas por mayúsculas/minúsculas: ${path}`,
      );
    }
    sourceKeys.add(foldedPath);
    if (!isSupportedSource(path)) {
      throw new PipelineError('INVALID_REPOSITORY', `Formato de origen no admitido: ${path}`);
    }
    const source = record(rawSource, `sources.${path}`);
    const rawSprites = record(source.sprites, `sources.${path}.sprites`);
    const rawAnimations = record(source.animations, `sources.${path}.animations`);
    if (Object.keys(rawSprites).length === 0) {
      throw new PipelineError('INVALID_REPOSITORY', `${path} no tiene sprites definidos.`);
    }
    const sprites: Record<string, SpriteDefinition> = {};
    const animations: Record<string, AnimationDefinition> = {};
    for (const [id, rawSprite] of Object.entries(rawSprites)) {
      assertIdentifier(id);
      if (allSprites.has(id))
        throw new PipelineError('INVALID_REPOSITORY', `Sprite duplicado: ${id}`);
      allSprites.add(id);
      const sprite = record(rawSprite, `sprite ${id}`);
      const pivot = record(sprite.pivot, `pivot ${id}`);
      const definition: SpriteDefinition = {
        x: sprite.x as number,
        y: sprite.y as number,
        width: sprite.width as number,
        height: sprite.height as number,
        pivot: { x: pivot.x as number, y: pivot.y as number },
      };
      assertRectangle(definition);
      assertPivot(definition.pivot);
      sprites[id] = definition;
    }
    for (const [id, rawAnimation] of Object.entries(rawAnimations)) {
      assertIdentifier(id);
      if (allAnimations.has(id))
        throw new PipelineError('INVALID_REPOSITORY', `Animación duplicada: ${id}`);
      allAnimations.add(id);
      const animation = record(rawAnimation, `animation ${id}`);
      if (animation.playback !== 'loop' && animation.playback !== 'once') {
        throw new PipelineError('INVALID_REPOSITORY', `Reproducción inválida en ${id}.`);
      }
      if (!Array.isArray(animation.frames)) {
        throw new PipelineError('INVALID_REPOSITORY', `Frames inválidos en ${id}.`);
      }
      const frames = animation.frames.map((rawFrame: unknown) => {
        const frame = record(rawFrame, `frame ${id}`);
        const sprite = string(frame.sprite, `frame ${id}.sprite`);
        if (!Object.hasOwn(sprites, sprite)) {
          throw new PipelineError(
            'INVALID_REPOSITORY',
            `El frame de ${id} referencia un sprite ajeno o inexistente: ${sprite}`,
          );
        }
        const durationMs = frame.durationMs as number;
        assertDuration(durationMs);
        return { sprite, durationMs };
      });
      animations[id] = { playback: animation.playback, frames };
    }
    sources[path] = { sprites, animations };
  }
  return sources;
}

function validateAtlases(value: unknown, useDefaultGap = false): Record<string, AtlasDefinition> {
  const rawAtlases = record(value, 'atlases');
  const atlases: Record<string, AtlasDefinition> = {};
  const names = new Set<string>();
  const assignedGroups = new Set<string>();
  for (const [name, rawAtlas] of Object.entries(rawAtlases)) {
    assertAtlasName(name);
    const folded = name.toLocaleLowerCase();
    if (names.has(folded)) {
      throw new PipelineError('INVALID_REPOSITORY', `Atlas duplicado por mayúsculas: ${name}`);
    }
    names.add(folded);
    const atlas = record(rawAtlas, `atlases.${name}`);
    const size = atlas.size as number;
    assertAtlasSize(size);
    const gap = useDefaultGap && atlas.gap === undefined ? 0 : (atlas.gap as number);
    assertAtlasGap(gap, size);
    if (!Array.isArray(atlas.groups)) {
      throw new PipelineError('INVALID_REPOSITORY', `Grupos inválidos en atlas ${name}.`);
    }
    const groups = atlas.groups.map((value, index) =>
      string(value, `atlases.${name}.groups.${index}`),
    );
    for (const group of groups) {
      assertIdentifier(group);
      if (group.includes('/')) {
        throw new PipelineError('INVALID_REPOSITORY', `Grupo inválido en atlas ${name}: ${group}`);
      }
      if (assignedGroups.has(group)) {
        throw new PipelineError('INVALID_REPOSITORY', `Grupo asignado más de una vez: ${group}`);
      }
      assignedGroups.add(group);
    }
    atlases[name] = { size, gap, groups };
  }
  return atlases;
}

/** Validates persisted data and migrates older versions in memory. Throws PipelineError on failure. */
export function validateRepositoryDatabase(value: unknown): RepositoryDatabase {
  const input = record(value, 'Repositorio');
  if (input.schemaVersion === 1) return migrateVersion1(input);
  if (input.schemaVersion === 2) return migrateVersion2(input);
  if (input.schemaVersion === 3) return migrateVersion3(input);
  if (input.schemaVersion !== 4) {
    throw new PipelineError('INVALID_REPOSITORY', 'Versión de repositorio desconocida.');
  }
  const base = validateVersion2(input);
  const atlases = validateAtlases(input.atlases);
  return { schemaVersion: 4, ...base, atlases };
}
