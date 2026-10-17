import { useEffect, useState } from 'react';
import { isDesktopApp } from '../adapters/environment.js';
import { subscribeOpenRepository } from '../adapters/tauri/deep-link.js';
import { ToastProvider } from '../components/Toast.js';
import { TooltipProvider } from '../components/ui/pixelact-ui/tooltip.js';
import { LauncherScreen } from '../features/project/LauncherScreen.js';
import { ProjectScreen } from '../features/project/ProjectScreen.js';

type View = { readonly kind: 'launcher' } | { readonly kind: 'project'; readonly root: string };

export function App() {
  const [view, setView] = useState<View>({ kind: 'launcher' });
  const desktop = isDesktopApp();

  useEffect(() => {
    if (!desktop) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void subscribeOpenRepository((request) => {
      if (disposed) return;
      setView(request.repo ? { kind: 'project', root: request.repo } : { kind: 'launcher' });
    }).then((dispose) => {
      if (disposed) dispose();
      else unsubscribe = dispose;
    });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [desktop]);

  if (!desktop) return <BrowserNotice />;

  return (
    <TooltipProvider>
      <ToastProvider>
        {view.kind === 'launcher' ? (
          <LauncherScreen onOpen={(root) => setView({ kind: 'project', root })} />
        ) : (
          <ProjectScreen root={view.root} onClose={() => setView({ kind: 'launcher' })} />
        )}
      </ToastProvider>
    </TooltipProvider>
  );
}

function BrowserNotice() {
  return (
    <main className="welcome-screen">
      <section className="welcome-card">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">Asset workspace</p>
        <h1>Assets Pipeline</h1>
        <p className="welcome-copy">
          Estás viendo la interfaz en un navegador. Las funciones de repositorio necesitan la app de
          escritorio: ejecuta <code>pnpm --filter @assets-pipeline/desktop tauri dev</code>.
        </p>
        <p className="version-label">Versión {__APP_VERSION__}</p>
      </section>
    </main>
  );
}
