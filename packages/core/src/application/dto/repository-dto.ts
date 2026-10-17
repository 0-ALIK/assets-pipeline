import type { FileEntry } from '../../ports/managed-files.js';

export type {
  AnimationLocation,
  AtlasSummary,
  GroupSummary,
  SpriteLocation,
} from '../../domain/entities/repository.js';

/** A repository entry plus its relationship with the persisted definitions. */
export interface ListedFile extends FileEntry {
  readonly status: 'defined' | 'undefined' | 'other' | 'missing';
}

/** Preview of a move or removal, computed before touching the filesystem. */
export interface PathChangePlan {
  readonly from: string;
  readonly to?: string;
  readonly kind: 'file' | 'directory';
  readonly definitions: readonly string[];
  readonly files: readonly string[];
  readonly directoriesToCreate: readonly string[];
}
