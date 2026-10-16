import { useState } from 'react';
import { Modal } from '../../components/Modal.js';
import { Field } from '../../components/Field.js';
import { useToast } from '../../components/Toast.js';
import { pickDirectory } from '../../adapters/tauri/dialogs.js';
import {
  canonicalPath,
  createTauriWorkspace,
  findRepositoryRoot,
  isRealDirectory,
} from '../../adapters/tauri/repository.js';
import { describeError } from './repository-context.js';
import { rememberProject } from './recents.js';

interface CreateProjectDialogProps {
  readonly onClose: () => void;
  readonly onCreated: (root: string) => void;
}

export function CreateProjectDialog({ onClose, onCreated }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [folder, setFolder] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const chooseFolder = async (): Promise<void> => {
    const picked = await pickDirectory('Selecciona la carpeta donde vivirá el proyecto');
    if (picked) setFolder(picked);
  };

  const create = async (): Promise<void> => {
    setError(null);
    if (name.trim() === '') {
      setError('El nombre del proyecto es obligatorio.');
      return;
    }
    if (!folder) {
      setError('Selecciona la carpeta del repositorio.');
      return;
    }
    setBusy(true);
    try {
      if (!(await isRealDirectory(folder))) {
        setError('La carpeta debe ser una carpeta real existente.');
        return;
      }
      const root = await canonicalPath(folder);
      if (await findRepositoryRoot(root)) {
        setError('Esta carpeta ya está dentro de un repositorio existente.');
        return;
      }
      await createTauriWorkspace(root).initialize(name.trim(), crypto.randomUUID());
      rememberProject(name.trim(), root);
      toast.success(`Proyecto creado: ${name.trim()}`);
      onCreated(root);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Nuevo proyecto"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void create()} disabled={busy}>
            {busy ? 'Creando…' : 'Crear proyecto'}
          </button>
        </>
      }
    >
      <div className="dialog-fields">
        <Field label="Nombre del proyecto">
          <input
            className="input"
            value={name}
            autoFocus
            placeholder="Mi proyecto de assets"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field
          label="Carpeta del repositorio"
          hint="Debe existir y no estar dentro de otro repositorio. La CLI llama a esto `init`."
        >
          <div className="folder-picker">
            <span className={`folder-value${folder ? '' : ' placeholder'}`}>
              {folder ?? 'Ninguna carpeta seleccionada'}
            </span>
            <button type="button" className="btn" onClick={() => void chooseFolder()} disabled={busy}>
              Elegir carpeta…
            </button>
          </div>
        </Field>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
