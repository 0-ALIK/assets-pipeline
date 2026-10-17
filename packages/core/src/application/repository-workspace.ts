import type { AtlasBuildPlan } from '../builders/packing/pack-atlases.js';
import type { Pivot, Rectangle, RepositoryDatabase } from '../domain/repository.js';
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
import { addAnimation as addAnimationUseCase } from './use-cases/animations/add-animation.js';
import { removeAnimation as removeAnimationUseCase } from './use-cases/animations/remove-animation.js';
import { renameAnimation as renameAnimationUseCase } from './use-cases/animations/rename-animation.js';
import { setAnimationPlayback as setAnimationPlaybackUseCase } from './use-cases/animations/set-animation-playback.js';
import { showAnimation as showAnimationUseCase } from './use-cases/animations/show-animation.js';
import { addAtlas as addAtlasUseCase } from './use-cases/atlases/add-atlas.js';
import { assignAtlasGroup as assignAtlasGroupUseCase } from './use-cases/atlases/assign-atlas-group.js';
import { listAtlases as listAtlasesUseCase } from './use-cases/atlases/list-atlases.js';
import { removeAtlas as removeAtlasUseCase } from './use-cases/atlases/remove-atlas.js';
import { setAtlas as setAtlasUseCase } from './use-cases/atlases/set-atlas.js';
import { showAtlas as showAtlasUseCase } from './use-cases/atlases/show-atlas.js';
import { unassignAtlasGroup as unassignAtlasGroupUseCase } from './use-cases/atlases/unassign-atlas-group.js';
import { makeDirectory as makeDirectoryUseCase } from './use-cases/files/make-directory.js';
import { movePath as movePathUseCase } from './use-cases/files/move-path.js';
import { planMove as planMoveUseCase } from './use-cases/files/plan-move.js';
import { planRemove as planRemoveUseCase } from './use-cases/files/plan-remove.js';
import { removePath as removePathUseCase } from './use-cases/files/remove-path.js';
import { addFrame as addFrameUseCase } from './use-cases/frames/add-frame.js';
import { moveFrame as moveFrameUseCase } from './use-cases/frames/move-frame.js';
import { removeFrame as removeFrameUseCase } from './use-cases/frames/remove-frame.js';
import { setFrame as setFrameUseCase } from './use-cases/frames/set-frame.js';
import { listGroups as listGroupsUseCase } from './use-cases/groups/list-groups.js';
import { showGroup as showGroupUseCase } from './use-cases/groups/show-group.js';
import { initializeRepository } from './use-cases/project/initialize-repository.js';
import { listFiles } from './use-cases/project/list-files.js';
import { planBuild as planBuildUseCase } from './use-cases/project/plan-build.js';
import { validateRepository as validateRepositoryUseCase } from './use-cases/project/validate-repository.js';
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

/**
 * Convenience facade over the Core use cases.
 *
 * Every method delegates to one use case in `application/use-cases/`; the
 * domain decisions and invariants live in the entities, and the ports are
 * injected through `WorkspaceOptions`. Kept as the stable entry point for the
 * CLI and the desktop app.
 */
export class RepositoryWorkspace {
  constructor(private readonly context: UseCaseContext) {}

  /** Creates a new versioned repository. Fails if one already exists. */
  async initialize(name: string, id: string): Promise<RepositoryDatabase> {
    return initializeRepository(this.context, { name, id });
  }

  /** Returns validated data. Older schema versions are migrated on read. */
  async read(): Promise<RepositoryDatabase> {
    return (await readRepository(this.context)).toJSON();
  }

  /** Lists repository entries with their definition status. */
  async list(): Promise<readonly ListedFile[]> {
    return listFiles(this.context);
  }

  /** Reports source-file issues; throws on invalid persisted data. */
  async validate(path?: string): Promise<readonly string[]> {
    return validateRepositoryUseCase(this.context, path === undefined ? {} : { path });
  }

  async listGroups(): Promise<readonly GroupSummary[]> {
    return listGroupsUseCase(this.context);
  }

  async showGroup(name: string): Promise<GroupSummary> {
    return showGroupUseCase(this.context, { name });
  }

  async listAtlases(): Promise<readonly AtlasSummary[]> {
    return listAtlasesUseCase(this.context);
  }

  async showAtlas(name: string): Promise<AtlasSummary> {
    return showAtlasUseCase(this.context, { name });
  }

  async addAtlas(name: string, size: number, gap = 0): Promise<void> {
    await addAtlasUseCase(this.context, { name, size, gap });
  }

  async setAtlas(name: string, size?: number, gap?: number): Promise<void> {
    await setAtlasUseCase(this.context, {
      name,
      ...(size === undefined ? {} : { size }),
      ...(gap === undefined ? {} : { gap }),
    });
  }

  async assignGroup(name: string, group: string): Promise<void> {
    await assignAtlasGroupUseCase(this.context, { atlas: name, group });
  }

  async unassignGroup(name: string, group: string): Promise<void> {
    await unassignAtlasGroupUseCase(this.context, { atlas: name, group });
  }

  async removeAtlas(name: string): Promise<void> {
    await removeAtlasUseCase(this.context, { name });
  }

  async planBuild(): Promise<AtlasBuildPlan> {
    return planBuildUseCase(this.context);
  }

  async listSprites(path: string): Promise<readonly SpriteLocation[]> {
    return listSpritesUseCase(this.context, { path });
  }

  async showSprite(id: string): Promise<SpriteLocation> {
    return showSpriteUseCase(this.context, { id });
  }

  async addSprite(path: string, id: string, rect: Rectangle, pivot: Pivot): Promise<void> {
    await addSpriteUseCase(this.context, { path, id, rect, pivot });
  }

  async setSprite(id: string, rect?: Rectangle, pivot?: Pivot): Promise<void> {
    await setSpriteUseCase(this.context, {
      id,
      ...(rect ? { rect } : {}),
      ...(pivot ? { pivot } : {}),
    });
  }

  async renameSprite(from: string, to: string): Promise<void> {
    await renameSpriteUseCase(this.context, { from, to });
  }

  async duplicateSprite(from: string, to: string): Promise<void> {
    await duplicateSpriteUseCase(this.context, { from, to });
  }

  async removeSprite(id: string): Promise<void> {
    await removeSpriteUseCase(this.context, { id });
  }

  async showAnimation(id: string): Promise<AnimationLocation> {
    return showAnimationUseCase(this.context, { id });
  }

  async addAnimation(path: string, id: string, playback: string): Promise<void> {
    await addAnimationUseCase(this.context, { path, id, playback });
  }

  async renameAnimation(from: string, to: string): Promise<void> {
    await renameAnimationUseCase(this.context, { from, to });
  }

  async setAnimationPlayback(id: string, playback: string): Promise<void> {
    await setAnimationPlaybackUseCase(this.context, { id, playback });
  }

  async removeAnimation(id: string): Promise<void> {
    await removeAnimationUseCase(this.context, { id });
  }

  async addFrame(id: string, sprite: string, durationMs: number, at?: number): Promise<void> {
    await addFrameUseCase(this.context, {
      animation: id,
      sprite,
      durationMs,
      ...(at === undefined ? {} : { at }),
    });
  }

  async setFrame(id: string, at: number, sprite?: string, durationMs?: number): Promise<void> {
    await setFrameUseCase(this.context, {
      animation: id,
      at,
      ...(sprite === undefined ? {} : { sprite }),
      ...(durationMs === undefined ? {} : { durationMs }),
    });
  }

  async moveFrame(id: string, from: number, to: number): Promise<void> {
    await moveFrameUseCase(this.context, { animation: id, from, to });
  }

  async removeFrame(id: string, at: number): Promise<void> {
    await removeFrameUseCase(this.context, { animation: id, at });
  }

  async planMove(from: string, to: string): Promise<PathChangePlan> {
    return planMoveUseCase(this.context, { from, to });
  }

  async movePath(from: string, to: string): Promise<PathChangePlan> {
    return movePathUseCase(this.context, { from, to });
  }

  async planRemove(path: string): Promise<PathChangePlan> {
    return planRemoveUseCase(this.context, { path });
  }

  async removePath(path: string, recursive: boolean): Promise<PathChangePlan> {
    return removePathUseCase(this.context, { path, recursive });
  }

  async makeDirectory(path: string): Promise<void> {
    await makeDirectoryUseCase(this.context, { path });
  }
}
