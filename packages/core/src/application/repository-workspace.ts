import { PipelineError } from '../domain/errors.js';
import {
  assertAtlasGap,
  assertAtlasName,
  assertAtlasSize,
  assertIdentifier,
  assertRectangle,
  assertSourcePath,
  isSupportedSource,
  groupFromIdentifier,
} from '../domain/rules.js';
import type { Pivot, Rectangle, RepositoryDatabase } from '../domain/repository.js';
import { planAtlasBuild, type AtlasBuildPlan } from '../builders/packing/pack-atlases.js';
import { validateRepositoryDatabase } from '../validation/repository-database.js';
import type { UseCaseContext } from './context.js';
import type {
  AnimationLocation,
  AtlasSummary,
  GroupSummary,
  ListedFile,
  PathChangePlan,
  SpriteLocation,
} from './dto/repository-dto.js';
import { readRepository } from './services/change-repository.js';
import { initializeRepository } from './use-cases/project/initialize-repository.js';
import { addAnimation as addAnimationUseCase } from './use-cases/animations/add-animation.js';
import { removeAnimation as removeAnimationUseCase } from './use-cases/animations/remove-animation.js';
import { renameAnimation as renameAnimationUseCase } from './use-cases/animations/rename-animation.js';
import { setAnimationPlayback as setAnimationPlaybackUseCase } from './use-cases/animations/set-animation-playback.js';
import { showAnimation as showAnimationUseCase } from './use-cases/animations/show-animation.js';
import { addFrame as addFrameUseCase } from './use-cases/frames/add-frame.js';
import { moveFrame as moveFrameUseCase } from './use-cases/frames/move-frame.js';
import { removeFrame as removeFrameUseCase } from './use-cases/frames/remove-frame.js';
import { setFrame as setFrameUseCase } from './use-cases/frames/set-frame.js';
import { addSprite as addSpriteUseCase } from './use-cases/sprites/add-sprite.js';
import { duplicateSprite as duplicateSpriteUseCase } from './use-cases/sprites/duplicate-sprite.js';
import { listSprites as listSpritesUseCase } from './use-cases/sprites/list-sprites.js';
import { removeSprite as removeSpriteUseCase } from './use-cases/sprites/remove-sprite.js';
import { renameSprite as renameSpriteUseCase } from './use-cases/sprites/rename-sprite.js';
import { setSprite as setSpriteUseCase } from './use-cases/sprites/set-sprite.js';
import { showSprite as showSpriteUseCase } from './use-cases/sprites/show-sprite.js';

export type {
  AnimationLocation,
  AtlasSummary,
  GroupSummary,
  ListedFile,
  PathChangePlan,
  SpriteLocation,
};

export type WorkspaceOptions = UseCaseContext;

type MutableDatabase = { -readonly [Key in keyof RepositoryDatabase]: RepositoryDatabase[Key] };

function owned<T>(value: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

function clone(database: RepositoryDatabase): MutableDatabase {
  return JSON.parse(JSON.stringify(database)) as MutableDatabase;
}

export class RepositoryWorkspace {
  constructor(private readonly options: WorkspaceOptions) {}

  /** Creates a new versioned repository. Fails if one already exists. */
  async initialize(name: string, id: string): Promise<RepositoryDatabase> {
    return initializeRepository(this.options, { name, id });
  }

  /** Returns validated data. Version 1 is migrated in memory on read. */
  async read(): Promise<RepositoryDatabase> {
    return (await readRepository(this.options)).toJSON();
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
    return listSpritesUseCase(this.options, { path });
  }

  async showSprite(id: string): Promise<SpriteLocation> {
    return showSpriteUseCase(this.options, { id });
  }

  async addSprite(path: string, id: string, rect: Rectangle, pivot: Pivot): Promise<void> {
    await addSpriteUseCase(this.options, { path, id, rect, pivot });
  }

  async setSprite(id: string, rect?: Rectangle, pivot?: Pivot): Promise<void> {
    await setSpriteUseCase(this.options, {
      id,
      ...(rect ? { rect } : {}),
      ...(pivot ? { pivot } : {}),
    });
  }

  async renameSprite(from: string, to: string): Promise<void> {
    await renameSpriteUseCase(this.options, { from, to });
  }

  async duplicateSprite(from: string, to: string): Promise<void> {
    await duplicateSpriteUseCase(this.options, { from, to });
  }

  async removeSprite(id: string): Promise<void> {
    await removeSpriteUseCase(this.options, { id });
  }

  async showAnimation(id: string): Promise<AnimationLocation> {
    return showAnimationUseCase(this.options, { id });
  }

  async addAnimation(path: string, id: string, playback: string): Promise<void> {
    await addAnimationUseCase(this.options, { path, id, playback });
  }

  async renameAnimation(from: string, to: string): Promise<void> {
    await renameAnimationUseCase(this.options, { from, to });
  }

  async setAnimationPlayback(id: string, playback: string): Promise<void> {
    await setAnimationPlaybackUseCase(this.options, { id, playback });
  }

  async removeAnimation(id: string): Promise<void> {
    await removeAnimationUseCase(this.options, { id });
  }

  async addFrame(id: string, sprite: string, durationMs: number, at?: number): Promise<void> {
    await addFrameUseCase(this.options, {
      animation: id,
      sprite,
      durationMs,
      ...(at === undefined ? {} : { at }),
    });
  }

  async setFrame(id: string, at: number, sprite?: string, durationMs?: number): Promise<void> {
    await setFrameUseCase(this.options, {
      animation: id,
      at,
      ...(sprite === undefined ? {} : { sprite }),
      ...(durationMs === undefined ? {} : { durationMs }),
    });
  }

  async moveFrame(id: string, from: number, to: number): Promise<void> {
    await moveFrameUseCase(this.options, { animation: id, from, to });
  }

  async removeFrame(id: string, at: number): Promise<void> {
    await removeFrameUseCase(this.options, { animation: id, at });
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
