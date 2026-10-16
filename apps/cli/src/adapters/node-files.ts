import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import {
  access,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import type {
  FileEntry,
  ImageSize,
  ManagedFiles,
  RepositoryFileSystem,
  StagedRemoval,
} from '@assets-pipeline/core';
import {
  PipelineError,
  assertSourcePath,
  parseAsepriteHeader,
  parsePngHeader,
} from '@assets-pipeline/core';

const cacheName = '.assets-pipeline-cache';
const execFileAsync = promisify(execFile);

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export function databasePath(root: string): string {
  return join(root, cacheName, 'db.json');
}

export async function assertCacheDirectory(root: string): Promise<void> {
  try {
    const stat = await lstat(join(root, cacheName));
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new PipelineError(
        'INVALID_REPOSITORY',
        'La carpeta interna del repositorio debe ser una carpeta real.',
      );
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

export async function ensureCacheDirectory(root: string): Promise<void> {
  await assertCacheDirectory(root);
  const cache = join(root, cacheName);
  await mkdir(cache, { recursive: true });
  if (process.platform === 'win32') await execFileAsync('attrib', ['+h', cache]);
}

async function assertDatabaseFile(path: string): Promise<void> {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new PipelineError('INVALID_REPOSITORY', 'db.json debe ser un archivo real.');
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

export async function findRepository(start: string): Promise<string | null> {
  let current = resolve(start);
  while (true) {
    if (await exists(databasePath(current))) {
      await assertCacheDirectory(current);
      await assertDatabaseFile(databasePath(current));
      return realpath(current);
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** Refuses symlink traversal and any path outside the repository. */
async function checkedPath(root: string, path: string): Promise<string> {
  assertSourcePath(path);
  if (isAbsolute(path))
    throw new PipelineError('INVALID_INPUT', 'Usa rutas relativas al repositorio.');
  const absolute = resolve(root, ...path.split('/'));
  const rel = relative(root, absolute);
  if (rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel)) {
    throw new PipelineError('INVALID_INPUT', 'La ruta sale del repositorio.');
  }
  let current = root;
  for (const segment of path.split('/')) {
    current = join(current, segment);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) {
        throw new PipelineError('INVALID_INPUT', `No se admiten enlaces simbólicos: ${path}`);
      }
      if (!(await readdir(dirname(current))).includes(segment)) {
        throw new PipelineError('INVALID_INPUT', `Usa las mayúsculas exactas de la ruta: ${path}`);
      }
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  return absolute;
}

export function createNodeRepositoryFileSystem(): RepositoryFileSystem {
  return {
    async readText(path): Promise<string | null> {
      await assertCacheDirectory(dirname(dirname(path)));
      await assertDatabaseFile(path);
      try {
        return await readFile(path, 'utf8');
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async writeTextAtomically(path, contents): Promise<void> {
      await assertCacheDirectory(dirname(dirname(path)));
      await assertDatabaseFile(path);
      await mkdir(dirname(path), { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, contents, { flag: 'wx' });
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true });
      }
    },
  };
}

export class NodeManagedFiles implements ManagedFiles {
  constructor(private readonly root: string) {}

  async kind(path: string): Promise<'file' | 'directory' | null> {
    const absolute = await checkedPath(this.root, path);
    try {
      const stat = await lstat(absolute);
      if (stat.isFile()) return 'file';
      if (stat.isDirectory()) return 'directory';
      throw new PipelineError('INVALID_INPUT', `Tipo de archivo no admitido: ${path}`);
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async list(): Promise<readonly FileEntry[]> {
    const entries: FileEntry[] = [];
    const visit = async (directory: string, prefix: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (prefix === '' && entry.name.toLowerCase() === cacheName) continue;
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) {
          entries.push({ path, kind: 'symlink' });
          continue;
        }
        if (entry.isDirectory()) {
          entries.push({ path, kind: 'directory' });
          const child = join(directory, entry.name);
          if (!(await exists(join(child, '.assets-pipeline-build')))) {
            await visit(child, path);
          }
        } else if (entry.isFile()) {
          entries.push({ path, kind: 'file' });
        }
      }
    };
    await visit(this.root, '');
    return entries;
  }

  async imageSize(path: string): Promise<ImageSize> {
    const absolute = await checkedPath(this.root, path);
    const handle = await open(absolute, 'r');
    try {
      const stat = await handle.stat();
      const buffer = Buffer.alloc(24);
      const { bytesRead } = await handle.read(buffer, 0, 24, 0);
      if (path.toLowerCase().endsWith('.png')) {
        return parsePngHeader(buffer.subarray(0, bytesRead), stat.size);
      }
      if (path.toLowerCase().endsWith('.aseprite')) {
        return parseAsepriteHeader(buffer.subarray(0, bytesRead), stat.size);
      }
      throw new PipelineError('INVALID_INPUT', `Formato de archivo no admitido: ${path}`);
    } finally {
      await handle.close();
    }
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(await checkedPath(this.root, path), { recursive: true });
  }

  async move(from: string, to: string): Promise<void> {
    const source = await checkedPath(this.root, from);
    const destination = await checkedPath(this.root, to);
    if (await exists(destination))
      throw new PipelineError('ALREADY_EXISTS', `El destino ya existe: ${to}`);
    const parent = await lstat(dirname(destination));
    if (!parent.isDirectory())
      throw new PipelineError('INVALID_INPUT', 'La carpeta de destino no existe.');
    await rename(source, destination);
  }

  async stageRemoval(path: string): Promise<StagedRemoval> {
    const source = await checkedPath(this.root, path);
    await assertCacheDirectory(this.root);
    const trash = join(this.root, cacheName, 'trash');
    await mkdir(trash, { recursive: true });
    const removalId = randomUUID();
    const staged = join(trash, removalId);
    if (relative(trash, staged) !== removalId) {
      throw new PipelineError('INVALID_REPOSITORY', 'Ruta de eliminación interna inválida.');
    }
    await rename(source, staged);
    return {
      commit: async () => {
        try {
          await rm(staged, { recursive: true, force: true });
        } catch {
          throw new PipelineError(
            'INVALID_REPOSITORY',
            `La metadata se actualizó, pero quedaron archivos por eliminar en ${staged}. Revísalos manualmente.`,
          );
        }
      },
      rollback: async () => rename(staged, source),
    };
  }
}
