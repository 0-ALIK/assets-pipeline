import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal.js';
import { EmptyState, Spinner } from '../../components/Field.js';
import { useToast } from '../../components/Toast.js';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { ArrowLeft, FolderOpen, RefreshCw, ShieldCheck } from 'lucide-react';
import { RepositoryProvider, describeError, useRepository } from './repository-context.js';
import { rememberProject } from './recents.js';

interface ProjectScreenProps {
  readonly root: string;
  readonly onClose: () => void;
}

export function ProjectScreen({ root, onClose }: ProjectScreenProps) {
  return (
    <RepositoryProvider root={root}>
      {() => <ProjectWorkspace onClose={onClose} />}
    </RepositoryProvider>
  );
}

function ProjectWorkspace({ onClose }: { onClose: () => void }) {
  const { root, database, files, workspace, busy, refresh } = useRepository();
  const [issues, setIssues] = useState<readonly string[] | null>(null);
  const toast = useToast();

  const name = database.project.name;

  useEffect(() => {
    // Keep the launcher list in date order and with the current project name.
    rememberProject(name, root);
  }, [name, root]);

  const sources = Object.values(database.sources);
  const spriteCount = sources.reduce(
    (total, source) => total + Object.keys(source.sprites).length,
    0,
  );
  const animationCount = sources.reduce(
    (total, source) => total + Object.keys(source.animations).length,
    0,
  );

  const validate = async (): Promise<void> => {
    try {
      const found = await workspace.validate();
      if (found.length === 0) {
        toast.success('Validación correcta.');
      } else {
        setIssues(found);
      }
    } catch (caught) {
      toast.error(describeError(caught));
    }
  };

  return (
    <div className="project-screen">
      <header className="project-header">
        <button type="button" className="btn btn-icon" aria-label="Volver al inicio" onClick={onClose}>
          <ArrowLeft size={16} />
        </button>
        <div className="project-title">
          <h1>{name}</h1>
          <span className="project-path" title={root}>
            {root}
          </span>
        </div>
        <div className="project-stats">
          <span className="stat">
            <strong>{Object.keys(database.sources).length}</strong> archivos
          </span>
          <span className="stat">
            <strong>{spriteCount}</strong> sprites
          </span>
          <span className="stat">
            <strong>{animationCount}</strong> animaciones
          </span>
          <span className="stat">Esquema {database.schemaVersion}</span>
        </div>
        <div className="project-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => void refresh()}>
            <RefreshCw size={15} /> Recargar
          </button>
          <button type="button" className="btn" onClick={() => void validate()}>
            <ShieldCheck size={15} /> Validar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void revealItemInDir(root).catch(() => undefined)}
          >
            <FolderOpen size={15} /> Carpeta
          </button>
        </div>
      </header>

      <div className="project-body">
        <aside className="explorer-panel" aria-label="Archivos del repositorio">
          {busy ? <Spinner label="Trabajando…" /> : null}
          <div className="explorer-placeholder">
            {files.length === 0
              ? 'El repositorio todavía no tiene archivos.'
              : 'Explorador de archivos en camino.'}
          </div>
        </aside>
        <section className="board" aria-label="Espacio de trabajo">
          <EmptyState title="Selecciona un archivo">
            Elige un PNG o Aseprite en el explorador para verlo en el canvas pixel perfect.
          </EmptyState>
        </section>
      </div>

      {issues ? (
        <Modal
          title={`Validación: ${issues.length} problema(s)`}
          onClose={() => setIssues(null)}
          width={640}
          footer={
            <button type="button" className="btn" onClick={() => setIssues(null)}>
              Cerrar
            </button>
          }
        >
          <ul className="issue-list">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Modal>
      ) : null}
    </div>
  );
}
