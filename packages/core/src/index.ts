export type {
  AnimationDefinition,
  AnimationFrame,
  AtlasDefinition,
  LegacyData,
  Pivot,
  ProjectConfiguration,
  Rectangle,
  RepositoryDatabase,
  SourceDefinitions,
  SpriteDefinition,
} from './domain/repository.js';
export { PipelineError } from './domain/errors.js';
export {
  assertAtlasGap,
  assertAtlasName,
  assertAtlasSize,
  assertDuration,
  assertIdentifier,
  assertPivot,
  assertRectangle,
  assertSourcePath,
  groupFromIdentifier,
  isSupportedSource,
} from './domain/rules.js';
export { parsePngHeader } from './importers/png/parse-png-header.js';
export { parseAsepriteHeader } from './importers/aseprite/parse-aseprite-header.js';
export { createJsonRepositoryStore } from './application/create-json-repository-store.js';
export { RepositoryWorkspace } from './application/repository-workspace.js';
export type {
  AnimationLocation,
  AtlasSummary,
  GroupSummary,
  ListedFile,
  PathChangePlan,
  SpriteLocation,
  WorkspaceOptions,
} from './application/repository-workspace.js';

/** Application context every use case receives. */
export type { UseCaseContext } from './application/context.js';

/** Domain model: the repository aggregate and its entities. */
export { Repository } from './domain/entities/repository.js';
export { Source } from './domain/entities/source.js';
export { Animation, assertPlayback } from './domain/entities/animation.js';
export { Atlas } from './domain/entities/atlas.js';
export type { RepositoryEventPayload } from './domain/events/repository-events.js';

/** Use cases: one module per workflow. */
export { initializeRepository } from './application/use-cases/project/initialize-repository.js';
export { listFiles } from './application/use-cases/project/list-files.js';
export { validateRepository } from './application/use-cases/project/validate-repository.js';
export { planBuild } from './application/use-cases/project/plan-build.js';
export { addSprite } from './application/use-cases/sprites/add-sprite.js';
export { setSprite } from './application/use-cases/sprites/set-sprite.js';
export { renameSprite } from './application/use-cases/sprites/rename-sprite.js';
export { duplicateSprite } from './application/use-cases/sprites/duplicate-sprite.js';
export { removeSprite } from './application/use-cases/sprites/remove-sprite.js';
export { autoRegionSprites } from './application/use-cases/sprites/auto-region-sprites.js';
export type {
  AutoRegionPlan,
  AutoRegionSprite,
  AutoRegionSpritesInput,
} from './application/use-cases/sprites/auto-region-sprites.js';
export { listSprites } from './application/use-cases/sprites/list-sprites.js';
export { showSprite } from './application/use-cases/sprites/show-sprite.js';
export { addAnimation } from './application/use-cases/animations/add-animation.js';
export { renameAnimation } from './application/use-cases/animations/rename-animation.js';
export { setAnimationPlayback } from './application/use-cases/animations/set-animation-playback.js';
export { removeAnimation } from './application/use-cases/animations/remove-animation.js';
export { showAnimation } from './application/use-cases/animations/show-animation.js';
export { addFrame } from './application/use-cases/frames/add-frame.js';
export { setFrame } from './application/use-cases/frames/set-frame.js';
export { moveFrame } from './application/use-cases/frames/move-frame.js';
export { removeFrame } from './application/use-cases/frames/remove-frame.js';
export { addAtlas } from './application/use-cases/atlases/add-atlas.js';
export { setAtlas } from './application/use-cases/atlases/set-atlas.js';
export { removeAtlas } from './application/use-cases/atlases/remove-atlas.js';
export { listAtlases } from './application/use-cases/atlases/list-atlases.js';
export { showAtlas } from './application/use-cases/atlases/show-atlas.js';
export { assignAtlasGroup } from './application/use-cases/atlases/assign-atlas-group.js';
export { unassignAtlasGroup } from './application/use-cases/atlases/unassign-atlas-group.js';
export { listGroups } from './application/use-cases/groups/list-groups.js';
export { showGroup } from './application/use-cases/groups/show-group.js';
export { planMove } from './application/use-cases/files/plan-move.js';
export { movePath } from './application/use-cases/files/move-path.js';
export { planRemove } from './application/use-cases/files/plan-remove.js';
export { removePath } from './application/use-cases/files/remove-path.js';
export { makeDirectory } from './application/use-cases/files/make-directory.js';

/** Application services shared by use cases. */
export { readRepository, changeRepository } from './application/services/change-repository.js';
export { planPathChange } from './application/services/path-change-planner.js';
export { buildAssets } from './application/services/build-assets.js';
export type { BuildAssetsInput, ImportedSource } from './application/services/build-assets.js';
export { detectContentRegions } from './application/services/content-regions.js';
export type {
  DetectContentRegionsInput,
  DetectContentRegionsResult,
} from './application/services/content-regions.js';

export { planAtlasBuild } from './builders/packing/pack-atlases.js';
export type {
  AtlasAnimationPlan,
  AtlasBuildPlan,
  AtlasPagePlan,
  AtlasPlacement,
  AtlasSourceSprite,
} from './builders/packing/pack-atlases.js';
export { validateRepositoryDatabase } from './validation/repository-database.js';
export type { AssetBuilder, BuildArtifact, BuildRequest } from './ports/asset-builder.js';
export type { AssetImporter, ImportRequest, ImportedAsset } from './ports/asset-importer.js';
export type { DomainEvent, EventPublisher } from './ports/event-publisher.js';
export type { FileEntry, ImageSize, ManagedFiles, StagedRemoval } from './ports/managed-files.js';
export type {
  RepositoryFileSystem,
  RepositoryStore,
  RepositoryStoreOptions,
} from './ports/repository-store.js';
