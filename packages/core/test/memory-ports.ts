import { PipelineError, RepositoryWorkspace, validateRepositoryDatabase } from '../src/index.js';
import type {
  FileEntry,
  ImageSize,
  ManagedFiles,
  RepositoryDatabase,
  RepositoryStore,
  StagedRemoval,
} from '../src/index.js';

type MemoryEntry = { readonly kind: 'file' | 'directory'; readonly size?: ImageSize };

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Repository store backed by memory; validates on write like the JSON store does. */
export class MemoryStore implements RepositoryStore {
  private database: RepositoryDatabase | null = null;
  writes = 0;

  seed(database: RepositoryDatabase): void {
    this.database = clone(database);
  }

  snapshot(): RepositoryDatabase | null {
    return this.database === null ? null : clone(this.database);
  }

  async read(): Promise<RepositoryDatabase | null> {
    return this.snapshot();
  }

  async write(database: RepositoryDatabase): Promise<void> {
    this.writes += 1;
    this.database = clone(validateRepositoryDatabase(database));
  }
}

/** Managed files port backed by an in-memory tree, including staged removals. */
export class MemoryFiles implements ManagedFiles {
  private readonly entries = new Map<string, MemoryEntry>();
  private readonly trash = new Map<string, Map<string, MemoryEntry>>();
  private nextToken = 1;

  addFile(path: string, size: ImageSize = { width: 64, height: 64 }): void {
    this.entries.set(path, { kind: 'file', size });
  }

  addDirectory(path: string): void {
    this.entries.set(path, { kind: 'directory' });
  }

  has(path: string): boolean {
    return this.entries.has(path);
  }

  paths(): readonly string[] {
    return [...this.entries.keys()].sort();
  }

  async kind(path: string): Promise<'file' | 'directory' | null> {
    return this.entries.get(path)?.kind ?? null;
  }

  async list(): Promise<readonly FileEntry[]> {
    return [...this.entries.entries()]
      .map(([path, entry]) => ({ path, kind: entry.kind }) as FileEntry)
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  async imageSize(path: string): Promise<ImageSize> {
    const entry = this.entries.get(path);
    if (!entry?.size) throw new PipelineError('NOT_FOUND', `Sin tamaño para ${path}.`);
    return entry.size;
  }

  async mkdir(path: string): Promise<void> {
    this.entries.set(path, { kind: 'directory' });
  }

  async move(from: string, to: string): Promise<void> {
    const moved: Array<[string, MemoryEntry]> = [];
    for (const [path, entry] of this.entries) {
      if (path === from || path.startsWith(`${from}/`)) {
        moved.push([path, entry]);
      }
    }
    for (const [path] of moved) this.entries.delete(path);
    for (const [path, entry] of moved) {
      this.entries.set(`${to}${path.slice(from.length)}`, entry);
    }
  }

  async stageRemoval(path: string): Promise<StagedRemoval> {
    const token = `staged-${this.nextToken++}`;
    const removed = new Map<string, MemoryEntry>();
    for (const [entryPath, entry] of this.entries) {
      if (entryPath === path || entryPath.startsWith(`${path}/`)) {
        removed.set(entryPath, entry);
      }
    }
    if (removed.size === 0) throw new PipelineError('NOT_FOUND', `Ruta no encontrada: ${path}`);
    for (const [entryPath] of removed) this.entries.delete(entryPath);
    this.trash.set(token, removed);
    return {
      commit: async () => {
        this.trash.delete(token);
      },
      rollback: async () => {
        for (const [entryPath, entry] of removed) this.entries.set(entryPath, entry);
        this.trash.delete(token);
      },
    };
  }
}

export const fixedNow = '2026-01-01T00:00:00.000Z';

export function createTestWorkspace(): {
  readonly workspace: RepositoryWorkspace;
  readonly store: MemoryStore;
  readonly files: MemoryFiles;
} {
  const store = new MemoryStore();
  const files = new MemoryFiles();
  const workspace = new RepositoryWorkspace({
    store,
    files,
    now: () => fixedNow,
  });
  return { workspace, store, files };
}

/** Seeds a repository with one 64x64 source and returns the harness. */
export async function seededWorkspace(): Promise<{
  workspace: RepositoryWorkspace;
  store: MemoryStore;
  files: MemoryFiles;
}> {
  const harness = createTestWorkspace();
  harness.files.addFile('hero.png');
  await harness.workspace.initialize('Test project', 'project-id');
  return harness;
}
