import { useEffect, useState } from 'react';
import type { PathChangePlan } from '@assets-pipeline/core';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/ui/pixelact-ui/input.js';
import { Modal } from '../../components/Modal.js';
import { Field, Spinner } from '../../components/Field.js';
import { useToast } from '../../components/Toast.js';
import { useRepository, describeError } from '../project/repository-context.js';
import { fileName, parentPath, childPath } from './tree.js';

function PlanPreview({ plan, kind }: { plan: PathChangePlan; kind: 'move' | 'remove' }) {
  const destination = (path: string): string =>
    plan.to ? `${plan.to}${path.slice(plan.from.length)}` : '';
  return (
    <div className="plan-preview">
      <p className="plan-summary">
        {kind === 'move' ? (
          <>
            Mover <code>{plan.kind === 'directory' ? 'carpeta' : 'archivo'}</code>{' '}
            <code>{plan.from}</code> → <code>{plan.to}</code>
          </>
        ) : (
          <>
            Eliminar <code>{plan.kind === 'directory' ? 'carpeta' : 'archivo'}</code>{' '}
            <code>{plan.from}</code>
          </>
        )}
      </p>
      {plan.definitions.length > 0 ? (
        <div className="plan-block">
          <h4>Definiciones afectadas</h4>
          <ul>
            {plan.definitions.map((path) => (
              <li key={path}>
                <code>{path}</code>
                {kind === 'move' ? (
                  <>
                    {' '}
                    → <code>{destination(path)}</code>
                  </>
                ) : (
                  <span className="plan-note"> (se eliminarán)</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {plan.files.filter((path) => !plan.definitions.includes(path)).length > 0 ? (
        <div className="plan-block">
          <h4>Archivos sin definiciones afectados</h4>
          <ul>
            {plan.files
              .filter((path) => !plan.definitions.includes(path))
              .map((path) => (
                <li key={path}>
                  <code>{path}</code>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {plan.directoriesToCreate.length > 0 ? (
        <div className="plan-block">
          <h4>Carpetas padre que se crearán</h4>
          <ul>
            {plan.directoriesToCreate.map((path) => (
              <li key={path}>
                <code>{path}/</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface NewFolderDialogProps {
  readonly parent: string;
  readonly onClose: () => void;
}

export function NewFolderDialog({ parent, onClose }: NewFolderDialogProps) {
  const { mutate } = useRepository();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const submit = async (): Promise<void> => {
    setError(null);
    if (
      name.trim() === '' ||
      name.includes('/') ||
      name.includes('\\') ||
      name === '.' ||
      name === '..'
    ) {
      setError('Escribe un nombre de carpeta válido (sin barras).');
      return;
    }
    const path = childPath(parent, name.trim());
    setBusy(true);
    const ok = await mutate((current) => current.makeDirectory(path));
    setBusy(false);
    if (ok) {
      toast.success(`Carpeta creada: ${path}`);
      onClose();
    }
  };

  return (
    <Modal
      title="Nueva carpeta"
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            Crear
          </Button>
        </>
      }
    >
      <Field
        label="Nombre"
        hint={parent === '' ? 'Se creará en la raíz del repositorio.' : `Dentro de ${parent}/`}
      >
        <Input
          className="mono"
          value={name}
          autoFocus
          placeholder="npc"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
        />
      </Field>
      {error ? <p className="form-error">{error}</p> : null}
    </Modal>
  );
}

interface RenameDialogProps {
  readonly path: string;
  readonly onClose: () => void;
}

export function RenameDialog({ path, onClose }: RenameDialogProps) {
  const { workspace, mutate } = useRepository();
  const [name, setName] = useState(fileName(path));
  const [plan, setPlan] = useState<PathChangePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const destination = childPath(parentPath(path), name.trim());

  const preview = async (): Promise<void> => {
    setError(null);
    if (
      name.trim() === '' ||
      name.includes('/') ||
      name.includes('\\') ||
      name === '.' ||
      name === '..'
    ) {
      setError('Escribe un nombre válido (sin barras).');
      return;
    }
    if (destination === path) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      setPlan(await workspace.planMove(path, destination));
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (): Promise<void> => {
    if (!plan) return;
    setBusy(true);
    const ok = await mutate(async (current) => {
      await current.movePath(path, destination);
    });
    setBusy(false);
    if (ok) {
      toast.success(`Renombrado: ${path} → ${destination}`);
      onClose();
    }
  };

  return (
    <Modal
      title="Renombrar"
      onClose={onClose}
      width={plan ? 660 : 500}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          {plan ? (
            <Button variant="primary" onClick={() => void confirm()} disabled={busy}>
              {busy ? 'Aplicando…' : 'Renombrar'}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void preview()} disabled={busy}>
              {busy ? 'Comprobando…' : 'Continuar'}
            </Button>
          )}
        </>
      }
    >
      {plan ? (
        <PlanPreview plan={plan} kind="move" />
      ) : (
        <>
          <Field label="Nuevo nombre">
            <Input
              className="mono"
              value={name}
              autoFocus
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void preview();
              }}
            />
          </Field>
          {error ? <p className="form-error">{error}</p> : null}
        </>
      )}
    </Modal>
  );
}

interface MoveDialogProps {
  readonly path: string;
  readonly onClose: () => void;
}

export function MoveDialog({ path, onClose }: MoveDialogProps) {
  const { files, workspace, mutate } = useRepository();
  const [destination, setDestination] = useState(path);
  const [plan, setPlan] = useState<PathChangePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const directories = files.filter((file) => file.kind === 'directory').map((file) => file.path);

  const preview = async (): Promise<void> => {
    setError(null);
    if (destination.trim() === '') {
      setError('Escribe la ruta de destino.');
      return;
    }
    if (destination === path) {
      setError('La ruta de destino es la misma que la actual.');
      return;
    }
    setBusy(true);
    try {
      setPlan(await workspace.planMove(path, destination));
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (): Promise<void> => {
    if (!plan) return;
    setBusy(true);
    const ok = await mutate(async (current) => {
      await current.movePath(path, destination);
    });
    setBusy(false);
    if (ok) {
      toast.success(`Movido: ${path} → ${destination}`);
      onClose();
    }
  };

  return (
    <Modal
      title="Mover"
      onClose={onClose}
      width={plan ? 660 : 560}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          {plan ? (
            <Button variant="primary" onClick={() => void confirm()} disabled={busy}>
              {busy ? 'Aplicando…' : 'Mover'}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void preview()} disabled={busy}>
              {busy ? 'Comprobando…' : 'Continuar'}
            </Button>
          )}
        </>
      }
    >
      {plan ? (
        <PlanPreview plan={plan} kind="move" />
      ) : (
        <>
          <Field
            label="Ruta de destino (relativa al repositorio)"
            hint="Se crean las carpetas padre que falten. Usa / como separador."
          >
            <Input
              className="mono"
              value={destination}
              autoFocus
              list="explorer-directories"
              onChange={(event) => setDestination(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void preview();
              }}
            />
          </Field>
          <datalist id="explorer-directories">
            {directories.map((directory) => (
              <option key={directory} value={`${directory}/`} />
            ))}
          </datalist>
          {error ? <p className="form-error">{error}</p> : null}
        </>
      )}
    </Modal>
  );
}

interface RemoveDialogProps {
  readonly path: string;
  readonly onClose: () => void;
}

export function RemoveDialog({ path, onClose }: RemoveDialogProps) {
  const { workspace, mutate } = useRepository();
  const [plan, setPlan] = useState<PathChangePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBusy(true);
      try {
        const nextPlan = await workspace.planRemove(path);
        if (!cancelled) setPlan(nextPlan);
      } catch (caught) {
        if (!cancelled) setError(describeError(caught));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, workspace]);

  const confirm = async (): Promise<void> => {
    if (!plan) return;
    setBusy(true);
    const recursive = plan.kind === 'directory';
    const ok = await mutate(async (current) => {
      await current.removePath(path, recursive);
    });
    setBusy(false);
    if (ok) {
      toast.success(`Eliminado: ${path}`);
      onClose();
    }
  };

  const affected = plan ? plan.files.filter((file) => !plan.definitions.includes(file)).length : 0;

  return (
    <Modal
      title="Eliminar"
      onClose={onClose}
      width={680}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={busy || !plan}>
            {busy ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="form-error">{error}</p>
      ) : !plan ? (
        <Spinner label="Calculando el impacto…" />
      ) : (
        <>
          {plan.kind === 'directory' && (plan.files.length > 0 || affected > 0) ? (
            <p className="plan-warning">
              La carpeta no está vacía: se eliminarán {plan.files.length} elemento(s) en total.
            </p>
          ) : null}
          <PlanPreview plan={plan} kind="remove" />
        </>
      )}
    </Modal>
  );
}
