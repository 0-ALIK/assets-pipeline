import { useCallback, useEffect, useState } from 'react';
import { Close } from 'pixelarticons/react/Close.js';
import { Folder } from 'pixelarticons/react/Folder.js';
import { Plus } from 'pixelarticons/react/Plus.js';
import { Search } from 'pixelarticons/react/Search.js';
import { WarningDiamond } from 'pixelarticons/react/WarningDiamond.js';
import { Button } from '../../components/Button.js';
import { EmptyState } from '../../components/Field.js';
import { askConfirmation, pickDirectory } from '../../adapters/tauri/dialogs.js';
import { canonicalPath, findRepositoryRoot } from '../../adapters/tauri/repository.js';
import { useToast } from '../../components/Toast.js';
import { CreateProjectDialog } from './CreateProjectDialog.js';
import { describeError } from './repository-context.js';
import { forgetProject, readRecents, rememberProject } from './recents.js';
import type { RecentProject } from './recents.js';

interface LauncherScreenProps {
  readonly onOpen: (root: string) => void;
}

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });

export function LauncherScreen({ onOpen }: LauncherScreenProps) {
  const [recents, setRecents] = useState<readonly RecentProject[]>(() => readRecents());
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const toast = useToast();

  const checkRecents = useCallback(async (projects: readonly RecentProject[]) => {
    const missingRoots = new Set<string>();
    for (const project of projects) {
      try {
        if (!(await findRepositoryRoot(project.root))) missingRoots.add(project.root);
      } catch {
        missingRoots.add(project.root);
      }
    }
    setMissing(missingRoots);
  }, []);

  useEffect(() => {
    void checkRecents(recents);
  }, [checkRecents, recents]);

  const openRecent = async (recent: RecentProject): Promise<void> => {
    try {
      const root = await findRepositoryRoot(recent.root);
      if (!root) {
        const confirmed = await askConfirmation(
          'Proyecto no encontrado',
          `No hay ningún repositorio en ${recent.root}. ¿Quieres quitarlo de la lista?`,
        );
        if (confirmed) setRecents(forgetProject(recent.root));
        return;
      }
      setRecents(rememberProject(recent.name, root));
      onOpen(root);
    } catch (caught) {
      toast.error(describeError(caught));
    }
  };

  const openFolder = async (): Promise<void> => {
    const folder = await pickDirectory('Selecciona la carpeta del repositorio');
    if (!folder) return;
    try {
      const root = await findRepositoryRoot(folder);
      if (!root) {
        toast.error('NOT_FOUND: esa carpeta no es un repositorio. Puedes crear uno nuevo.');
        return;
      }
      const canonical = await canonicalPath(folder);
      if (canonical.toLowerCase() !== root.toLowerCase()) {
        toast.info(`Abriendo la raíz del repositorio: ${root}`);
      }
      onOpen(root);
    } catch (caught) {
      toast.error(describeError(caught));
    }
  };

  return (
    <main className="launcher">
      <section className="launcher-hero">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">Asset workspace</p>
        <h1>Assets Pipeline</h1>
        <p className="welcome-copy">
          Organiza tus fuentes PNG y Aseprite, define sprites y animaciones, y prepara atlas desde
          una sola herramienta.
        </p>
        <div className="launcher-actions">
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus width={24} height={24} /> Crear proyecto
          </Button>
          <Button onClick={() => void openFolder()}>
            <Folder width={24} height={24} /> Abrir carpeta
          </Button>
        </div>
        <p className="version-label">Versión {__APP_VERSION__}</p>
      </section>

      <section className="launcher-panel" aria-labelledby="recent-title">
        <header className="panel-header">
          <h2 id="recent-title">Proyectos recientes</h2>
        </header>
        {recents.length === 0 ? (
          <EmptyState icon={<Search width={32} height={32} />} title="Todavía no hay proyectos">
            Crea un proyecto nuevo o abre una carpeta existente.
          </EmptyState>
        ) : (
          <ul className="recent-list">
            {recents.map((recent) => {
              const isMissing = missing.has(recent.root);
              return (
                <li key={recent.root} className={`recent-item${isMissing ? ' is-missing' : ''}`}>
                  <button
                    type="button"
                    className="recent-main"
                    onClick={() => void openRecent(recent)}
                  >
                    <span className="recent-name">{recent.name}</span>
                    <span className="recent-path">{recent.root}</span>
                    <span className="recent-time">
                      {isMissing ? (
                        <>
                          <WarningDiamond width={16} height={16} /> No encontrado
                        </>
                      ) : (
                        `Última apertura: ${dateFormat.format(new Date(recent.lastOpenedAt))}`
                      )}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Quitar ${recent.name} de la lista`}
                    onClick={() => setRecents(forgetProject(recent.root))}
                  >
                    <Close width={24} height={24} />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {createOpen ? (
        <CreateProjectDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(root) => {
            setCreateOpen(false);
            onOpen(root);
          }}
        />
      ) : null}
    </main>
  );
}
