import { PipelineError } from '../errors.js';
import type { RepositoryEventPayload } from '../events/repository-events.js';
import type {
  AnimationDefinition,
  AtlasDefinition,
  LegacyData,
  Pivot,
  ProjectConfiguration,
  Rectangle,
  RepositoryDatabase,
  SourceDefinitions,
  SpriteDefinition,
} from '../repository.js';
import { assertAtlasGap, assertAtlasName, assertAtlasSize } from '../value-objects/atlas.js';
import { assertDuration } from '../value-objects/duration.js';
import { groupFromIdentifier } from '../value-objects/identifier.js';
import type { Animation } from './animation.js';
import { Atlas } from './atlas.js';
import { Source } from './source.js';

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

export interface GroupSummary {
  readonly name: string;
  readonly spriteIds: readonly string[];
}

export interface AtlasSummary {
  readonly name: string;
  readonly atlas: AtlasDefinition;
}

/**
 * Aggregate root for `.assets-pipeline-cache/db.json`. Commands enforce every
 * repository-wide invariant and record the domain events they complete; the
 * application service persists `toJSON()` and publishes `drainEvents()`.
 *
 * Instances are transactional: mutate, then persist; discard on failure.
 */
export class Repository {
  private project: ProjectConfiguration;
  private readonly sources = new Map<string, Source>();
  private readonly atlases = new Map<string, Atlas>();
  private events: RepositoryEventPayload[] = [];

  private constructor(
    project: ProjectConfiguration,
    private readonly legacy?: LegacyData,
  ) {
    this.project = { ...project };
  }

  static create(project: ProjectConfiguration): Repository {
    const repository = new Repository(project);
    repository.record({ type: 'repository.initialized', projectId: project.id });
    return repository;
  }

  static fromJSON(database: RepositoryDatabase): Repository {
    const repository = new Repository(database.project, database.legacy);
    for (const [path, definitions] of Object.entries(database.sources)) {
      repository.sources.set(path, Source.fromJSON(path, definitions));
    }
    for (const [name, definition] of Object.entries(database.atlases)) {
      repository.atlases.set(name, Atlas.fromJSON(definition));
    }
    return repository;
  }

  get configuration(): ProjectConfiguration {
    return { ...this.project };
  }

  get sourcePaths(): readonly string[] {
    return [...this.sources.keys()];
  }

  get atlasNames(): readonly string[] {
    return [...this.atlases.keys()];
  }

  source(path: string): Source | undefined {
    return this.sources.get(path);
  }

  atlas(name: string): Atlas | undefined {
    return this.atlases.get(name);
  }

  requireAtlas(name: string): Atlas {
    const atlas = this.atlases.get(name);
    if (!atlas) throw new PipelineError('NOT_FOUND', `Atlas no encontrado: ${name}`);
    return atlas;
  }

  sprite(id: string): SpriteLocation | undefined {
    for (const [path, source] of this.sources) {
      const sprite = source.sprite(id);
      if (sprite) return { path, id, sprite };
    }
    return undefined;
  }

  requireSprite(id: string): SpriteLocation {
    const found = this.sprite(id);
    if (!found) throw new PipelineError('NOT_FOUND', `Sprite no encontrado: ${id}`);
    return found;
  }

  animation(id: string): AnimationLocation | undefined {
    const found = this.animationEntity(id, false);
    return found ? { path: found.path, id, animation: found.animation.toJSON() } : undefined;
  }

  requireAnimation(id: string): AnimationLocation {
    const found = this.animationEntity(id);
    return { path: found.path, id, animation: found.animation.toJSON() };
  }

  private animationEntity(id: string): {
    readonly path: string;
    readonly source: Source;
    readonly animation: Animation;
  };
  private animationEntity(
    id: string,
    required: false,
  ): { readonly path: string; readonly source: Source; readonly animation: Animation } | undefined;
  private animationEntity(
    id: string,
    required = true,
  ): { readonly path: string; readonly source: Source; readonly animation: Animation } | undefined {
    for (const [path, source] of this.sources) {
      const animation = source.animation(id);
      if (animation) return { path, source, animation };
    }
    if (required) throw new PipelineError('NOT_FOUND', `Animación no encontrada: ${id}`);
    return undefined;
  }

  listGroups(): readonly GroupSummary[] {
    const groups = new Map<string, string[]>();
    for (const source of this.sources.values()) {
      for (const id of source.spriteIds) {
        const group = groupFromIdentifier(id);
        groups.set(group, [...(groups.get(group) ?? []), id]);
      }
    }
    return [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, spriteIds]) => ({ name, spriteIds: spriteIds.sort() }));
  }

  requireGroup(name: string): GroupSummary {
    const group = this.listGroups().find((candidate) => candidate.name === name);
    if (!group) throw new PipelineError('NOT_FOUND', `Grupo no encontrado: ${name}`);
    return group;
  }

  listAtlases(): readonly AtlasSummary[] {
    return [...this.atlases.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, atlas]) => ({ name, atlas: atlas.toJSON() }));
  }

  addSprite(path: string, id: string, rect: Rectangle, pivot: Pivot): void {
    if (this.sprite(id)) throw new PipelineError('ALREADY_EXISTS', `Sprite existente: ${id}`);
    const source = this.sources.get(path) ?? Source.create(path);
    source.addSprite(id, rect, pivot);
    this.sources.set(path, source);
    this.record({ type: 'sprite.added', path, id });
  }

  setSprite(id: string, rect?: Rectangle, pivot?: Pivot): void {
    const found = this.requireSprite(id);
    const source = this.sources.get(found.path)!;
    source.setSprite(id, rect ?? found.sprite, pivot ?? found.sprite.pivot);
    this.record({ type: 'sprite.updated', id });
  }

  renameSprite(from: string, to: string): void {
    if (this.sprite(to)) throw new PipelineError('ALREADY_EXISTS', `Sprite existente: ${to}`);
    const found = this.requireSprite(from);
    this.sources.get(found.path)!.renameSprite(from, to);
    this.record({ type: 'sprite.renamed', from, to });
  }

  duplicateSprite(from: string, to: string): void {
    if (this.sprite(to)) throw new PipelineError('ALREADY_EXISTS', `Sprite existente: ${to}`);
    const found = this.requireSprite(from);
    this.sources.get(found.path)!.duplicateSprite(from, to);
    this.record({ type: 'sprite.duplicated', from, to });
  }

  removeSprite(id: string): void {
    const found = this.requireSprite(id);
    const source = this.sources.get(found.path)!;
    const { sourceDropped } = source.removeSprite(id);
    if (sourceDropped) this.sources.delete(found.path);
    this.record({ type: 'sprite.removed', id });
  }

  addAnimation(path: string, id: string, playback: string): void {
    if (this.animation(id)) {
      throw new PipelineError('ALREADY_EXISTS', `Animación existente: ${id}`);
    }
    const source = this.sources.get(path);
    if (!source) throw new PipelineError('NOT_FOUND', `Archivo sin definiciones: ${path}`);
    source.addAnimation(id, playback);
    this.record({ type: 'animation.added', path, id });
  }

  renameAnimation(from: string, to: string): void {
    if (this.animation(to)) {
      throw new PipelineError('ALREADY_EXISTS', `Animación existente: ${to}`);
    }
    const found = this.animationEntity(from);
    found.source.renameAnimation(from, to);
    this.record({ type: 'animation.renamed', from, to });
  }

  setAnimationPlayback(id: string, playback: string): void {
    const found = this.animationEntity(id);
    found.animation.setPlayback(playback);
    this.record({ type: 'animation.updated', id });
  }

  removeAnimation(id: string): void {
    const found = this.animationEntity(id);
    found.source.removeAnimation(id);
    this.record({ type: 'animation.removed', id });
  }

  addFrame(animationId: string, sprite: string, durationMs: number, at?: number): void {
    assertDuration(durationMs);
    const found = this.animationEntity(animationId);
    if (!found.source.hasSprite(sprite)) {
      throw new PipelineError(
        'INVALID_INPUT',
        `El sprite ${sprite} no pertenece al archivo de la animación.`,
      );
    }
    const index = found.animation.addFrame(sprite, durationMs, at);
    this.record({ type: 'frame.added', animation: animationId, sprite, durationMs, at: index });
  }

  setFrame(animationId: string, at: number, sprite?: string, durationMs?: number): void {
    if (sprite === undefined && durationMs === undefined) {
      throw new PipelineError('INVALID_INPUT', 'Indica --sprite o --duration.');
    }
    if (durationMs !== undefined) assertDuration(durationMs);
    const found = this.animationEntity(animationId);
    if (!Number.isInteger(at) || at < 0 || at >= found.animation.frameCount) {
      throw new PipelineError('INVALID_INPUT', `Índice de frame fuera de rango: ${at}.`);
    }
    if (sprite !== undefined && !found.source.hasSprite(sprite)) {
      throw new PipelineError(
        'INVALID_INPUT',
        `El sprite ${sprite} no pertenece al archivo de la animación.`,
      );
    }
    found.animation.setFrame(at, sprite, durationMs);
    this.record({ type: 'frame.updated', animation: animationId, at });
  }

  moveFrame(animationId: string, from: number, to: number): void {
    const found = this.animationEntity(animationId);
    found.animation.moveFrame(from, to);
    this.record({ type: 'frame.moved', animation: animationId, from, to });
  }

  removeFrame(animationId: string, at: number): void {
    const found = this.animationEntity(animationId);
    found.animation.removeFrame(at);
    this.record({ type: 'frame.removed', animation: animationId, at });
  }

  addAtlas(name: string, size: number, gap: number): void {
    assertAtlasName(name);
    assertAtlasSize(size);
    assertAtlasGap(gap, size);
    const folded = name.toLocaleLowerCase();
    for (const candidate of this.atlases.keys()) {
      if (candidate.toLocaleLowerCase() === folded) {
        throw new PipelineError('ALREADY_EXISTS', `Atlas existente: ${name}`);
      }
    }
    this.atlases.set(name, Atlas.create(size, gap));
    this.record({ type: 'atlas.added', name, size, gap });
  }

  setAtlas(name: string, size?: number, gap?: number): void {
    if (size === undefined && gap === undefined) {
      throw new PipelineError('INVALID_INPUT', 'Indica --size o --gap.');
    }
    const atlas = this.requireAtlas(name);
    atlas.setSizeAndGap(size, gap);
    this.record({ type: 'atlas.updated', name });
  }

  removeAtlas(name: string): void {
    this.requireAtlas(name);
    this.atlases.delete(name);
    this.record({ type: 'atlas.removed', name });
  }

  assignGroup(atlasName: string, group: string): void {
    const defined = this.requireGroup(group);
    const atlas = this.requireAtlas(atlasName);
    for (const [otherName, other] of this.atlases) {
      if (other.hasGroup(defined.name)) {
        throw new PipelineError(
          'ALREADY_EXISTS',
          `El grupo ${group} ya pertenece al atlas ${otherName}.`,
        );
      }
    }
    atlas.assignGroup(defined.name);
    this.record({ type: 'atlas.group-assigned', atlas: atlasName, group: defined.name });
  }

  unassignGroup(atlasName: string, group: string): void {
    const atlas = this.requireAtlas(atlasName);
    if (!atlas.hasGroup(group)) {
      throw new PipelineError('NOT_FOUND', `El grupo ${group} no pertenece al atlas ${atlasName}.`);
    }
    atlas.unassignGroup(group);
    this.record({ type: 'atlas.group-unassigned', atlas: atlasName, group });
  }

  touch(now: string): void {
    this.project = { ...this.project, updatedAt: now };
  }

  drainEvents(): readonly RepositoryEventPayload[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  toJSON(): RepositoryDatabase {
    const sources: Record<string, SourceDefinitions> = {};
    for (const [path, source] of this.sources) {
      sources[path] = source.toJSON();
    }
    const atlases: Record<string, AtlasDefinition> = {};
    for (const [name, atlas] of this.atlases) {
      atlases[name] = atlas.toJSON();
    }
    return {
      schemaVersion: 4,
      project: { ...this.project },
      sources,
      atlases,
      ...(this.legacy ? { legacy: this.legacy } : {}),
    };
  }

  private record(event: RepositoryEventPayload): void {
    this.events.push(event);
  }
}
