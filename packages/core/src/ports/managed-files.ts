export interface FileEntry {
  readonly path: string;
  readonly kind: 'file' | 'directory' | 'symlink';
}

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

export interface StagedRemoval {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/** All paths passed to this port are validated, repository-relative paths. */
export interface ManagedFiles {
  kind(path: string): Promise<'file' | 'directory' | null>;
  list(): Promise<readonly FileEntry[]>;
  imageSize(path: string): Promise<ImageSize>;
  mkdir(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  stageRemoval(path: string): Promise<StagedRemoval>;
}
