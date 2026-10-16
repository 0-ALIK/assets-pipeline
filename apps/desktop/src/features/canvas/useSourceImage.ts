import { useCallback, useEffect, useRef, useState } from 'react';
import { renderSourceImage } from '../../adapters/tauri/images.js';
import { describeError } from '../project/repository-context.js';

const cache = new Map<string, ImageBitmap>();

function cacheKey(root: string, path: string): string {
  return `${root}::${path}`;
}

/** Drops decoded bitmaps so the next load reads the file again. */
export function invalidateSourceImage(root: string, path?: string): void {
  for (const [key, bitmap] of cache) {
    if (path === undefined ? key.startsWith(`${root}::`) : key === cacheKey(root, path)) {
      bitmap.close();
      cache.delete(key);
    }
  }
}

export interface SourceImageState {
  readonly image: ImageBitmap | null;
  readonly loading: boolean;
  readonly error: string | null;
  reload(): void;
}

export function useSourceImage(root: string, path: string | null): SourceImageState {
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestKey = useRef<string | null>(path ? cacheKey(root, path) : null);

  const load = useCallback(
    async (force: boolean) => {
      if (!path) {
        setImage(null);
        setError(null);
        return;
      }
      const key = cacheKey(root, path);
      if (!force) {
        const cached = cache.get(key);
        if (cached) {
          setImage(cached);
          setError(null);
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        const bitmap = await renderSourceImage(root, path);
        if (latestKey.current !== key) {
          bitmap.close();
          return;
        }
        const previous = cache.get(key);
        if (previous && previous !== bitmap) previous.close();
        cache.set(key, bitmap);
        setImage(bitmap);
      } catch (caught) {
        if (latestKey.current === key) {
          setError(describeError(caught));
          setImage(null);
        }
      } finally {
        if (latestKey.current === key) setLoading(false);
      }
    },
    [path, root],
  );

  useEffect(() => {
    latestKey.current = path ? cacheKey(root, path) : null;
    void load(false);
  }, [load, path, root]);

  const reload = useCallback(() => {
    if (path) {
      const cached = cache.get(cacheKey(root, path));
      if (cached) {
        cached.close();
        cache.delete(cacheKey(root, path));
      }
    }
    void load(true);
  }, [load, path, root]);

  return { image, loading, error, reload };
}
