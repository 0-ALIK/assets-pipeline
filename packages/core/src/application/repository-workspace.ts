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
  groupFromIdentifier,
} from '../domain/rules.js';
import type {
  AnimationDefinition,
  AtlasDefinition,
  AnimationFrame,
  Pivot,
  Rectangle,
  RepositoryDatabase,
  SourceDefinitions,
  SpriteDefinition,
} from '../domain/repository.js';
import { planAtlasBuild, type AtlasBuildPlan } from '../builders/packing/pack-atlases.js';
import type { FileEntry, ManagedFiles } from '../ports/managed-files.js';
import type { RepositoryStore } from '../ports/repository-store.js';
import { validateRepositoryDatabase } from './validate-repository-database.js';

export interface WorkspaceOptions {
  readonly store: RepositoryStore;
  readonly files: ManagedFiles;
  readonly now: () => string;
}

export interface SpriteLocation {
  readonly path: string;
  readonly id: string;
  readonly sprite: SpriteDefinition;
}

export interface AnimationLocation {
  readonly path: string;
  readonly id: string;
  readonly animation: AnimationDefinition;
}

export interface ListedFile extends FileEntry {
  readonly status: 'defined' | 'undefined' | 'other' | 'missing';
}

export interface PathChangePlan {
  readonly from: string;
  readonly to?: string;
  readonly kind: 'file' | 'directory';
  readonly definitions: readonly string[];
  readonly files: readonly string[];
  readonly directoriesToCreate: readonly string[];
}

export interface GroupSummary {
  readonly name: string;
  readonly spriteIds: readonly string[];
}

export interface AtlasSummary {
  readonly name: string;
  readonly atlas: AtlasDefinition;
}

type MutableDatabase = { -readonly [Key in keyof RepositoryDatabase]: RepositoryDatabase[Key] };

function owned<T>(value: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

function findSprite(database: RepositoryDatabase, id: string): SpriteLocation {
  for (const [path, source] of Object.entries(database.sources)) {
    const sprite = owned(source.sprites, id);
    if (sprite) return { path, id, sprite };
  }
  throw new PipelineError('NOT_FOUND', `Sprite no encontrado: ${id}`);
}

function findAnimation(database: RepositoryDatabase, id: string): AnimationLocation {
  for (const [path, source] of Object.entries(database.sources)) {
    const animation = owned(source.animations, id);
    if (animation) return { path, id, animation };
  }
  throw new PipelineError('NOT_FOUND', `Animación no encontrada: ${id}`);
}

function hasSprite(database: RepositoryDatabase, id: string): boolean {
  return Object.values(database.sources).some((source) => Object.hasOwn(source.sprites, id));
}

function hasAnimation(database: RepositoryDatabase, id: string): boolean {
  return Object.values(database.sources).some((source) => Object.hasOwn(source.animations, id));
}

function sourceAt(database: RepositoryDatabase, path: string): SourceDefinitions {
  const source = owned(database.sources, path);
  if (!source) throw new PipelineError('NOT_FOUND', `Archivo sin definiciones: ${path}`);
  return source;
}

function checkedPlayback(value: string): 'loop' | 'once' {
  if (value !== 'loop' && value !== 'once') {
    throw new PipelineError('INVALID_INPUT', 'La reproducción debe ser loop u once.');
  }
  return value;
}

function checkedIndex(index: number, length: number, allowEnd = false): void {
  if (!Number.isInteger(index) || index < 0 || index > length - (allowEnd ? 0 : 1)) {
    throw new PipelineError('INVALID_INPUT', `Índice de frame fuera de rango: ${index}.`);
  }
}

function clone(database: RepositoryDatabase): MutableDatabase {
  return JSON.parse(JSON.stringify(database)) as MutableDatabase;
}

export class RepositoryWorkspace {
  constructor(private readonly options: WorkspaceOptions) {}

  /** Creates a new versioned repository. Fails if one already exists. */
  async initialize(name: string, id: string): Promise<RepositoryDatabase> {
    if (name.trim() === '' || id.trim() === '') {
      throw new PipelineError('INVALID_INPUT', 'El nombre y el ID del proyecto son obligatorios.');
    }
    if (await this.options.store.read()) {
      throw new PipelineError('ALREADY_EXISTS', 'Ya existe un repositorio en esta carpeta.');
    }
    const now = this.options.now();
    const database: RepositoryDatabase = {
      schemaVersion: 4,
      project: { id, name: name.trim(), createdAt: now, updatedAt: now },
      sources: {},
      atlases: {},
    };
    await this.options.store.write(database);
    return database;
  }

  /** Returns validated data. Version 1 is migrated in memory on read. */
  async read(): Promise<RepositoryDatabase> {
    const database = await this.options.store.read();
    if (!database) throw new PipelineError('NOT_FOUND', 'No se encontró db.json del repositorio.');
    return database;
  }

  private async change(action: (database: MutableDatabase) => Promise<void> | void): Promise<void> {
    const database = clone(await this.read());
    await action(database);
    database.project = { ...database.project, updatedAt: this.options.now() };
    await this.options.store.write(validateRepositoryDatabase(database));
  }

  async list(): Promise<readonly ListedFile[]> {
    const database = await this.read();
    const entries = await this.options.files.list();
    const listed: ListedFile[] = entries.map((entry) => ({
      ...entry,
      status:
        entry.kind !== 'file'
          ? 'other'
          : Object.hasOwn(database.sources, entry.path)
            ? 'defined'
            : isSupportedSource(entry.path)
              ? 'undefined'
              : 'other',
    }));
    const present = new Set(entries.map((entry) => entry.path));
    for (const path of Object.keys(database.sources)) {
      if (!present.has(path)) listed.push({ path, kind: 'file', status: 'missing' });
    }
    return listed.sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Reports source-file issues. Invalid persisted JSON is thrown by read(). */
  async validate(path?: string): Promise<readonly string[]> {
    const database = await this.read();
    if (path) assertSourcePath(path);
    if (path && !isSupportedSource(path)) {
      throw new PipelineError('INVALID_INPUT', 'Solo se validan archivos PNG y Aseprite.');
    }
    const entries = path ? [] : await this.options.files.list();
    const paths = path
      ? [path]
      : [
          ...new Set([
            ...Object.keys(database.sources),
            ...entries
              .filter((entry) => entry.kind === 'file' && isSupportedSource(entry.path))
              .map((entry) => entry.path),
          ]),
        ];
    const issues: string[] = [];
    for (const sourcePath of paths) {
      const source = owned(database.sources, sourcePath);
      try {
        const size = await this.options.files.imageSize(sourcePath);
        for (const [id, sprite] of Object.entries(source?.sprites ?? {})) {
          try {
            assertRectangle(sprite, size.width, size.height);
          } catch {
            issues.push(`Región fuera de la imagen: ${id} (${sourcePath})`);
          }
        }
      } catch (error) {
        issues.push(`${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (!path && Object.keys(database.atlases).length > 0) {
      try {
        planAtlasBuild(database);
      } catch (error) {
        issues.push(error instanceof Error ? error.message : String(error));
      }
    }
    return issues;
  }

  async listGroups(): Promise<readonly GroupSummary[]> {
    const database = await this.read();
    const groups = new Map<string, string[]>();
    for (const source of Object.values(database.sources)) {
      for (const id of Object.keys(source.sprites)) {
        const group = groupFromIdentifier(id);
        groups.set(group, [...(groups.get(group) ?? []), id]);
      }
    }
    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, spriteIds]) => ({ name, spriteIds: spriteIds.sort() }));
  }

  async showGroup(name: string): Promise<GroupSummary> {
    assertIdentifier(name);
    if (name.includes('/')) {
      throw new PipelineError('INVALID_INPUT', 'Un grupo es solo el primer segmento de un ID.');
    }
    const group = (await this.listGroups()).find((candidate) => candidate.name === name);
    if (!group) throw new PipelineError('NOT_FOUND', `Grupo no encontrado: ${name}`);
    return group;
  }

  async listAtlases(): Promise<readonly AtlasSummary[]> {
    return Object.entries((await this.read()).atlases)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, atlas]) => ({ name, atlas }));
  }

  async showAtlas(name: string): Promise<AtlasSummary> {
    const atlas = owned((await this.read()).atlases, name);
    if (!atlas) throw new PipelineError('NOT_FOUND', `Atlas no encontrado: ${name}`);
    return { name, atlas };
  }

  async addAtlas(name: string, size: number, gap = 0): Promise<void> {
    assertAtlasName(name);
    assertAtlasSize(size);
    assertAtlasGap(gap, size);
    await this.change((database) => {
      if (
        Object.keys(database.atlases).some(
          (candidate) => candidate.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      ) {
        throw new PipelineError('ALREADY_EXISTS', `Atlas existente: ${name}`);
      }
      database.atlases = { ...database.atlases, [name]: { size, gap, groups: [] } };
    });
  }

  async setAtlas(name: string, size?: number, gap?: number): Promise<void> {
    if (size === undefined && gap === undefined) {
      throw new PipelineError('INVALID_INPUT', 'Indica --size o --gap.');
    }
    await this.change((database) => {
      const atlas = owned(database.atlases, name);
      if (!atlas) throw new PipelineError('NOT_FOUND', `Atlas no encontrado: ${name}`);
      const nextSize = size ?? atlas.size;
      const nextGap = gap ?? atlas.gap;
      assertAtlasSize(nextSize);
      assertAtlasGap(nextGap, nextSize);
      database.atlases = {
        ...database.atlases,
        [name]: { ...atlas, size: nextSize, gap: nextGap },
      };
    });
  }

  async assignGroup(name: string, group: string): Promise<void> {
    const defined = await this.showGroup(group);
    await this.change((database) => {
      const atlas = owned(database.atlases, name);
      if (!atlas) throw new PipelineError('NOT_FOUND', `Atlas no encontrado: ${name}`);
      for (const [otherName, other] of Object.entries(database.atlases)) {
        if (other.groups.includes(defined.name)) {
          throw new PipelineError(
            'ALREADY_EXISTS',
            `El grupo ${group} ya pertenece al atlas ${otherName}.`,
          );
        }
      }
      database.atlases = {
        ...database.atlases,
        [name]: { ...atlas, groups: [...atlas.groups, defined.name].sort() },
      };
    });
  }

  async unassignGroup(name: string, group: string): Promise<void> {
    await this.change((database) => {
      const atlas = owned(database.atlases, name);
      if (!atlas) throw new PipelineError('NOT_FOUND', `Atlas no encontrado: ${name}`);
      if (!atlas.groups.includes(group)) {
        throw new PipelineError('NOT_FOUND', `El grupo ${group} no pertenece al atlas ${name}.`);
      }
      database.atlases = {
        ...database.atlases,
        [name]: { ...atlas, groups: atlas.groups.filter((candidate) => candidate !== group) },
      };
    });
  }

  async removeAtlas(name: string): Promise<void> {
    await this.change((database) => {
      if (!owned(database.atlases, name)) {
        throw new PipelineError('NOT_FOUND', `Atlas no encontrado: ${name}`);
      }
      const atlases = { ...database.atlases };
      delete atlases[name];
      database.atlases = atlases;
    });
  }

  async planBuild(): Promise<AtlasBuildPlan> {
    return planAtlasBuild(await this.read());
  }

  async listSprites(path: string): Promise<readonly SpriteLocation[]> {
    assertSourcePath(path);
    if (!isSupportedSource(path))
      throw new PipelineError('INVALID_INPUT', 'Solo se admiten PNG y Aseprite.');
    const source = owned((await this.read()).sources, path);
    if (!source) return [];
    return Object.entries(source.sprites).map(([id, sprite]) => ({ path, id, sprite }));
  }

  async showSprite(id: string): Promise<SpriteLocation> {
    return findSprite(await this.read(), id);
  }

  async addSprite(path: string, id: string, rect: Rectangle, pivot: Pivot): Promise<void> {
    assertSourcePath(path);
    assertIdentifier(id);
    if (!isSupportedSource(path))
      throw new PipelineError('INVALID_INPUT', 'Solo se admiten PNG y Aseprite.');
    assertPivot(pivot);
    const size = await this.options.files.imageSize(path);
    assertRectangle(rect, size.width, size.height);
    await this.change((database) => {
      if (hasSprite(database, id))
        throw new PipelineError('ALREADY_EXISTS', `Sprite existente: ${id}`);
      const source = owned(database.sources, path) ?? { sprites: {}, animations: {} };
      database.sources = {
        ...database.sources,
        [path]: { ...source, sprites: { ...source.sprites, [id]: { ...rect, pivot } } },
      };
    });
  }

  async setSprite(id: string, rect?: Rectangle, pivot?: Pivot): Promise<void> {
    if (!rect && !pivot) throw new PipelineError('INVALID_INPUT', 'Indica --rect o --pivot.');
    if (pivot) assertPivot(pivot);
    const current = findSprite(await this.read(), id);
    const next = { ...current.sprite, ...(rect ?? {}), ...(pivot ? { pivot } : {}) };
    const size = await this.options.files.imageSize(current.path);
    assertRectangle(next, size.width, size.height);
    await this.change((database) => {
      const found = findSprite(database, id);
      const source = sourceAt(database, found.path);
      database.sources = {
        ...database.sources,
        [found.path]: { ...source, sprites: { ...source.sprites, [id]: next } },
      };
    });
  }

  async renameSprite(from: string, to: string): Promise<void> {
    assertIdentifier(to);
    await this.change((database) => {
      if (hasSprite(database, to))
        throw new PipelineError('ALREADY_EXISTS', `Sprite existente: ${to}`);
      const found = findSprite(database, from);
      const source = sourceAt(database, found.path);
      const sprites = { ...source.sprites };
      delete sprites[from];
      sprites[to] = found.sprite;
      const animations = Object.fromEntries(
        Object.entries(source.animations).map(([id, animation]) => [
          id,
          {
            ...animation,
            frames: animation.frames.map((frame) =>
              frame.sprite === from ? { ...frame, sprite: to } : frame,
            ),
          },
        ]),
      );
      database.sources = { ...database.sources, [found.path]: { sprites, animations } };
    });
  }

  async duplicateSprite(from: string, to: string): Promise<void> {
    assertIdentifier(to);
    await this.change((database) => {
      if (hasSprite(database, to))
        throw new PipelineError('ALREADY_EXISTS', `Sprite existente: ${to}`);
      const found = findSprite(database, from);
      const source = sourceAt(database, found.path);
      database.sources = {
        ...database.sources,
        [found.path]: { ...source, sprites: { ...source.sprites, [to]: found.sprite } },
      };
    });
  }

  async removeSprite(id: string): Promise<void> {
    await this.change((database) => {
      const found = findSprite(database, id);
      const source = sourceAt(database, found.path);
      for (const [animationId, animation] of Object.entries(source.animations)) {
        if (animation.frames.some((frame) => frame.sprite === id)) {
          throw new PipelineError(
            'IN_USE',
            `El sprite ${id} se usa en la animación ${animationId}.`,
          );
        }
      }
      const sprites = { ...source.sprites };
      delete sprites[id];
      if (Object.keys(sprites).length === 0) {
        if (Object.keys(source.animations).length > 0) {
          throw new PipelineError('IN_USE', 'Elimina primero las animaciones del archivo.');
        }
        const sources = { ...database.sources };
        delete sources[found.path];
        database.sources = sources;
      } else {
        database.sources = { ...database.sources, [found.path]: { ...source, sprites } };
      }
    });
  }

  async showAnimation(id: string): Promise<AnimationLocation> {
    return findAnimation(await this.read(), id);
  }

  async addAnimation(path: string, id: string, playback: string): Promise<void> {
    assertSourcePath(path);
    assertIdentifier(id);
    const mode = checkedPlayback(playback);
    await this.change((database) => {
      if (hasAnimation(database, id))
        throw new PipelineError('ALREADY_EXISTS', `Animación existente: ${id}`);
      const source = sourceAt(database, path);
      database.sources = {
        ...database.sources,
        [path]: {
          ...source,
          animations: { ...source.animations, [id]: { playback: mode, frames: [] } },
        },
      };
    });
  }

  async renameAnimation(from: string, to: string): Promise<void> {
    assertIdentifier(to);
    await this.change((database) => {
      if (hasAnimation(database, to))
        throw new PipelineError('ALREADY_EXISTS', `Animación existente: ${to}`);
      const found = findAnimation(database, from);
      const source = sourceAt(database, found.path);
      const animations = { ...source.animations };
      delete animations[from];
      animations[to] = found.animation;
      database.sources = { ...database.sources, [found.path]: { ...source, animations } };
    });
  }

  async setAnimationPlayback(id: string, playback: string): Promise<void> {
    const mode = checkedPlayback(playback);
    await this.change((database) => {
      const found = findAnimation(database, id);
      const source = sourceAt(database, found.path);
      database.sources = {
        ...database.sources,
        [found.path]: {
          ...source,
          animations: { ...source.animations, [id]: { ...found.animation, playback: mode } },
        },
      };
    });
  }

  async removeAnimation(id: string): Promise<void> {
    await this.change((database) => {
      const found = findAnimation(database, id);
      const source = sourceAt(database, found.path);
      const animations = { ...source.animations };
      delete animations[id];
      database.sources = { ...database.sources, [found.path]: { ...source, animations } };
    });
  }

  private async updateFrames(
    id: string,
    update: (frames: AnimationFrame[], source: SourceDefinitions) => void,
  ): Promise<void> {
    await this.change((database) => {
      const found = findAnimation(database, id);
      const source = sourceAt(database, found.path);
      const frames = [...found.animation.frames];
      update(frames, source);
      database.sources = {
        ...database.sources,
        [found.path]: {
          ...source,
          animations: { ...source.animations, [id]: { ...found.animation, frames } },
        },
      };
    });
  }

  async addFrame(id: string, sprite: string, durationMs: number, at?: number): Promise<void> {
    assertDuration(durationMs);
    await this.updateFrames(id, (frames, source) => {
      if (!Object.hasOwn(source.sprites, sprite)) {
        throw new PipelineError(
          'INVALID_INPUT',
          `El sprite ${sprite} no pertenece al archivo de la animación.`,
        );
      }
      const index = at ?? frames.length;
      checkedIndex(index, frames.length, true);
      frames.splice(index, 0, { sprite, durationMs });
    });
  }

  async setFrame(id: string, at: number, sprite?: string, durationMs?: number): Promise<void> {
    if (sprite === undefined && durationMs === undefined) {
      throw new PipelineError('INVALID_INPUT', 'Indica --sprite o --duration.');
    }
    if (durationMs !== undefined) assertDuration(durationMs);
    await this.updateFrames(id, (frames, source) => {
      checkedIndex(at, frames.length);
      if (sprite !== undefined && !Object.hasOwn(source.sprites, sprite)) {
        throw new PipelineError(
          'INVALID_INPUT',
          `El sprite ${sprite} no pertenece al archivo de la animación.`,
        );
      }
      const current = frames[at]!;
      frames[at] = {
        sprite: sprite ?? current.sprite,
        durationMs: durationMs ?? current.durationMs,
      };
    });
  }

  async moveFrame(id: string, from: number, to: number): Promise<void> {
    await this.updateFrames(id, (frames) => {
      checkedIndex(from, frames.length);
      checkedIndex(to, frames.length, true);
      const [frame] = frames.splice(from, 1);
      frames.splice(to, 0, frame!);
    });
  }

  async removeFrame(id: string, at: number): Promise<void> {
    await this.updateFrames(id, (frames) => {
      checkedIndex(at, frames.length);
      frames.splice(at, 1);
    });
  }

  private async planPath(path: string, to?: string): Promise<PathChangePlan> {
    assertSourcePath(path);
    if (to) assertSourcePath(to);
    const kind = await this.options.files.kind(path);
    if (!kind) throw new PipelineError('NOT_FOUND', `Ruta no encontrada: ${path}`);
    if (kind === 'file' && !isSupportedSource(path)) {
      throw new PipelineError('INVALID_INPUT', 'Solo se administran archivos PNG y Aseprite.');
    }
    if (to) {
      if (to === path || (kind === 'directory' && to.startsWith(`${path}/`))) {
        throw new PipelineError(
          'INVALID_INPUT',
          'No se puede mover una carpeta dentro de sí misma.',
        );
      }
      if (await this.options.files.kind(to)) {
        throw new PipelineError('ALREADY_EXISTS', `El destino ya existe: ${to}`);
      }
      if (
        kind === 'file' &&
        path.slice(path.lastIndexOf('.')).toLowerCase() !==
          to.slice(to.lastIndexOf('.')).toLowerCase()
      ) {
        throw new PipelineError(
          'INVALID_INPUT',
          'El destino debe conservar el formato del archivo.',
        );
      }
    }
    const directoriesToCreate: string[] = [];
    if (to) {
      const segments = to.split('/');
      for (let length = 1; length < segments.length; length += 1) {
        const parent = segments.slice(0, length).join('/');
        const parentKind = await this.options.files.kind(parent);
        if (parentKind === 'file') {
          throw new PipelineError('INVALID_INPUT', `El padre del destino es un archivo: ${parent}`);
        }
        if (!parentKind) directoriesToCreate.push(parent);
      }
    }
    const database = await this.read();
    const files =
      kind === 'file'
        ? [path]
        : (await this.options.files.list())
            .filter((entry) => entry.kind !== 'directory' && entry.path.startsWith(`${path}/`))
            .map((entry) => entry.path);
    const definitions = Object.keys(database.sources).filter(
      (key) => key === path || (kind === 'directory' && key.startsWith(`${path}/`)),
    );
    if (to) {
      for (const sourcePath of definitions) {
        const destination = `${to}${sourcePath.slice(path.length)}`;
        if (Object.hasOwn(database.sources, destination) && !definitions.includes(destination)) {
          throw new PipelineError(
            'ALREADY_EXISTS',
            `El destino ya tiene definiciones: ${destination}`,
          );
        }
      }
    }
    return { from: path, ...(to ? { to } : {}), kind, definitions, files, directoriesToCreate };
  }

  async planMove(from: string, to: string): Promise<PathChangePlan> {
    return this.planPath(from, to);
  }

  async movePath(from: string, to: string): Promise<PathChangePlan> {
    const plan = await this.planMove(from, to);
    const database = clone(await this.read());
    const sources = { ...database.sources };
    for (const path of plan.definitions) {
      const source = sources[path]!;
      delete sources[path];
      sources[`${to}${path.slice(from.length)}`] = source;
    }
    database.sources = sources;
    database.project = { ...database.project, updatedAt: this.options.now() };
    for (const directory of plan.directoriesToCreate) {
      await this.options.files.mkdir(directory);
    }
    await this.options.files.move(from, to);
    try {
      await this.options.store.write(validateRepositoryDatabase(database));
    } catch (error) {
      try {
        await this.options.files.move(to, from);
      } catch {
        throw new PipelineError(
          'INVALID_REPOSITORY',
          `No se pudo revertir el movimiento ${from} → ${to}; revisa el archivo y db.json.`,
        );
      }
      throw error;
    }
    return plan;
  }

  async planRemove(path: string): Promise<PathChangePlan> {
    return this.planPath(path);
  }

  async removePath(path: string, recursive: boolean): Promise<PathChangePlan> {
    const plan = await this.planRemove(path);
    if (plan.kind === 'directory' && !recursive) {
      const entries = await this.options.files.list();
      if (entries.some((entry) => entry.path.startsWith(`${path}/`))) {
        throw new PipelineError('INVALID_INPUT', 'La carpeta no está vacía; usa --recursive.');
      }
    }
    const database = clone(await this.read());
    const sources = { ...database.sources };
    for (const sourcePath of plan.definitions) delete sources[sourcePath];
    database.sources = sources;
    database.project = { ...database.project, updatedAt: this.options.now() };
    const staged = await this.options.files.stageRemoval(path);
    try {
      await this.options.store.write(validateRepositoryDatabase(database));
    } catch (error) {
      await staged.rollback();
      throw error;
    }
    await staged.commit();
    return plan;
  }

  async makeDirectory(path: string): Promise<void> {
    assertSourcePath(path);
    if (await this.options.files.kind(path)) {
      throw new PipelineError('ALREADY_EXISTS', `La ruta ya existe: ${path}`);
    }
    await this.options.files.mkdir(path);
  }
}
