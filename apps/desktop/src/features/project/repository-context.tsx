import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { PipelineError } from '@assets-pipeline/core';
import type { ListedFile, RepositoryDatabase, RepositoryWorkspace } from '@assets-pipeline/core';
import { withRepositoryLock } from '../../adapters/tauri/lock.js';
import { createTauriWorkspace } from '../../adapters/tauri/repository.js';
import { Button } from '../../components/Button.js';
import { Spinner } from '../../components/Field.js';
import { useToast } from '../../components/Toast.js';

interface RepositoryContextValue {
  readonly root: string;
  readonly workspace: RepositoryWorkspace;
  readonly database: RepositoryDatabase;
  readonly files: readonly ListedFile[];
  readonly busy: boolean;
  refresh(): Promise<void>;
  mutate(action: (workspace: RepositoryWorkspace) => Promise<void>): Promise<boolean>;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export function describeError(error: unknown): string {
  if (error instanceof PipelineError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

interface ProviderProps {
  readonly root: string;
  readonly children: (value: RepositoryContextValue) => ReactNode;
}

export function RepositoryProvider({ root, children }: ProviderProps) {
  const workspace = useMemo(() => createTauriWorkspace(root), [root]);
  const [database, setDatabase] = useState<RepositoryDatabase | null>(null);
  const [files, setFiles] = useState<readonly ListedFile[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const nextDatabase = await workspace.read();
      const nextFiles = await workspace.list();
      setDatabase(nextDatabase);
      setFiles(nextFiles);
      setLoadError(null);
    } catch (error) {
      setLoadError(describeError(error));
    }
  }, [workspace]);

  useEffect(() => {
    setDatabase(null);
    setFiles([]);
    setLoadError(null);
    void load();
  }, [load]);

  // The CLI can edit the same repository while the app is open.
  useEffect(() => {
    const handleFocus = (): void => {
      if (!busyRef.current) void load();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const mutate = useCallback(
    async (action: (workspace: RepositoryWorkspace) => Promise<void>): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      try {
        await withRepositoryLock(root, () => action(workspace));
        await load();
        return true;
      } catch (error) {
        toast.error(describeError(error));
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [load, root, toast, workspace],
  );

  if (loadError !== null) {
    return (
      <div className="load-error" role="alert">
        <h2>No se pudo abrir el repositorio</h2>
        <p>{loadError}</p>
        <div className="load-error-actions">
          <Button onClick={() => void load()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  if (!database) {
    return (
      <div className="screen-loading">
        <Spinner label="Leyendo el repositorio…" />
      </div>
    );
  }

  const value: RepositoryContextValue = {
    root,
    workspace,
    database,
    files,
    busy,
    refresh,
    mutate,
  };

  return <RepositoryContext.Provider value={value}>{children(value)}</RepositoryContext.Provider>;
}

export function useRepository(): RepositoryContextValue {
  const value = useContext(RepositoryContext);
  if (!value) throw new Error('useRepository debe usarse dentro de RepositoryProvider.');
  return value;
}
