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
