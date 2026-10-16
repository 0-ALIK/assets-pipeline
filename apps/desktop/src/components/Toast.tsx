import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastEntry {
  readonly id: number;
  readonly kind: ToastKind;
  readonly message: string;
}

interface ToastApi {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly ToastEntry[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current;
    nextId.current += 1;
    setEntries((current) => [...current, { id, kind, message }]);
    window.setTimeout(
      () => setEntries((current) => current.filter((entry) => entry.id !== id)),
      kind === 'error' ? 9000 : 5000,
    );
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {entries.map((entry) => (
          <div key={entry.id} className={`toast toast-${entry.kind}`}>
            <span>{entry.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Cerrar aviso"
              onClick={() => setEntries((current) => current.filter((item) => item.id !== entry.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast debe usarse dentro de ToastProvider.');
  return api;
}
