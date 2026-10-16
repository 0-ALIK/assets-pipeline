import { PipelineError, parseAsepriteHeader, parsePngHeader } from '@assets-pipeline/core';
import type { FileEntry, ImageSize, ManagedFiles, StagedRemoval } from '@assets-pipeline/core';
import { call } from './commands.js';

interface FileHead {
  readonly size: number;
  readonly bytes: readonly number[];
}

/** Implements the Core managed files port with root-scoped Rust commands. */
export class TauriManagedFiles implements ManagedFiles {
  constructor(private readonly root: string) {}

  async kind(path: string): Promise<'file' | 'directory' | null> {
    const kind = await call<'file' | 'directory' | null>('path_kind', {
      root: this.root,
      path,
    });
    return kind === 'file' || kind === 'directory' ? kind : null;
  }

  async list(): Promise<readonly FileEntry[]> {
    return call<FileEntry[]>('list_entries', { root: this.root });
  }

  async imageSize(path: string): Promise<ImageSize> {
    const head = await call<FileHead>('read_file_head', {
      root: this.root,
      path,
      length: 24,
    });
    const bytes = Uint8Array.from(head.bytes);
    if (path.toLowerCase().endsWith('.png')) return parsePngHeader(bytes, head.size);
    if (path.toLowerCase().endsWith('.aseprite')) return parseAsepriteHeader(bytes, head.size);
    throw new PipelineError('INVALID_INPUT', `Formato de archivo no admitido: ${path}`);
  }

  async mkdir(path: string): Promise<void> {
    await call<void>('make_directory', { root: this.root, path });
  }

  async move(from: string, to: string): Promise<void> {
    await call<void>('move_path', { root: this.root, from, to });
  }

  async stageRemoval(path: string): Promise<StagedRemoval> {
    const token = await call<string>('stage_removal', { root: this.root, path });
    return {
      commit: () => call<void>('commit_removal', { root: this.root, token }),
      rollback: () => call<void>('rollback_removal', { root: this.root, token, path }),
    };
  }
}
