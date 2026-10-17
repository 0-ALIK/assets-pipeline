import { useState } from 'react';
import { PipelineError, assertIdentifier } from '@assets-pipeline/core';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/ui/pixelact-ui/input.js';
import { Modal } from '../../components/Modal.js';
import { Field } from '../../components/Field.js';

interface RenameAnimationDialogProps {
  readonly currentId: string;
  readonly busy: boolean;
  readonly onRename: (id: string) => Promise<boolean>;
  readonly onClose: () => void;
}

export function RenameAnimationDialog({
  currentId,
  busy,
  onRename,
  onClose,
}: RenameAnimationDialogProps) {
  const [id, setId] = useState(currentId);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const submit = async (): Promise<void> => {
    setError(null);
    try {
      assertIdentifier(id);
      if (id === currentId) {
        onClose();
        return;
      }
    } catch (caught) {
      setError(caught instanceof PipelineError ? caught.message : String(caught));
      return;
    }
    setWorking(true);
    const ok = await onRename(id);
    setWorking(false);
    if (ok) onClose();
    else setError('No se pudo renombrar (revisa el aviso de error).');
  };

  return (
    <Modal
      title="Renombrar animación"
      onClose={onClose}
      width={500}
      footer={
        <>
          <Button onClick={onClose} disabled={working || busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={working || busy}>
            {working ? 'Renombrando…' : 'Renombrar'}
          </Button>
        </>
      }
    >
      <Field label="Nuevo ID">
        <Input
          className="mono"
          value={id}
          autoFocus
          onChange={(event) => setId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
        />
      </Field>
      {error ? <p className="form-error">{error}</p> : null}
    </Modal>
  );
}
