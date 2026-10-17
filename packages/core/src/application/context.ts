import type { AssetBuilder } from '../ports/asset-builder.js';
import type { AssetImporter } from '../ports/asset-importer.js';
import type { EventPublisher } from '../ports/event-publisher.js';
import type { ManagedFiles } from '../ports/managed-files.js';
import type { RepositoryStore } from '../ports/repository-store.js';

/**
 * Dependencies every use case receives. Hosts wire the ports: the CLI injects
 * Node adapters, the desktop app injects Tauri adapters.
 */
export interface UseCaseContext {
  readonly store: RepositoryStore;
  readonly files: ManagedFiles;
  readonly now: () => string;
  /** Optional: domain events are collected and dropped when absent. */
  readonly events?: EventPublisher;
  /** Required by the build workflow: renders the planned atlases. */
  readonly builder?: AssetBuilder;
  /** Required by the build workflow: decodes PNG and Aseprite sources. */
  readonly importers?: readonly AssetImporter[];
}
