import { useState } from 'react';
import {
  PipelineError,
  assertIdentifier,
  assertPivot,
  assertRectangle,
} from '@assets-pipeline/core';
import type { SpriteDefinition } from '@assets-pipeline/core';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/ui/pixelact-ui/input.js';
import { Modal } from '../../components/Modal.js';
import { Field } from '../../components/Field.js';
import type { Pivot, Rect } from './sprite-editor.js';

export interface SpriteEditValues {
  readonly id: string;
  readonly rect: Rect;
  readonly pivot: Pivot;
}

interface EditSpriteDialogProps {
  readonly spriteId: string;
  readonly sprite: SpriteDefinition;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly busy: boolean;
  readonly onSubmit: (values: SpriteEditValues) => Promise<boolean>;
  readonly onClose: () => void;
}

export function EditSpriteDialog({
  spriteId,
  sprite,
  imageWidth,
  imageHeight,
  busy,
  onSubmit,
  onClose,
}: EditSpriteDialogProps) {
  const [id, setId] = useState(spriteId);
  const [rect, setRect] = useState<Rect>({
    x: sprite.x,
    y: sprite.y,
    width: sprite.width,
    height: sprite.height,
  });
  const [pivot, setPivot] = useState<Pivot>({ x: sprite.pivot.x, y: sprite.pivot.y });
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const submit = async (): Promise<void> => {
    setError(null);
    try {
      assertIdentifier(id);
      assertRectangle(rect, imageWidth || undefined, imageHeight || undefined);
      assertPivot(pivot);
    } catch (caught) {
      setError(caught instanceof PipelineError ? caught.message : String(caught));
      return;
    }
    setWorking(true);
    const ok = await onSubmit({ id, rect, pivot });
    setWorking(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title="Editar sprite"
      onClose={onClose}
      width={620}
      footer={
        <>
          <Button onClick={onClose} disabled={working || busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={working || busy}>
            {working ? 'Aplicando…' : 'Aplicar'}
          </Button>
        </>
      }
    >
      <Field label="ID" hint="Cambiar el ID actualiza las animaciones que referencian este sprite.">
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
      <div className="grid-4">
        <Field label="x">
          <Input
            type="number"
            value={String(rect.x)}
            onChange={(event) => setRect({ ...rect, x: Number(event.target.value) })}
          />
        </Field>
        <Field label="y">
          <Input
            type="number"
            value={String(rect.y)}
            onChange={(event) => setRect({ ...rect, y: Number(event.target.value) })}
          />
        </Field>
        <Field label="Ancho">
          <Input
            type="number"
            value={String(rect.width)}
            onChange={(event) => setRect({ ...rect, width: Number(event.target.value) })}
          />
        </Field>
        <Field label="Alto">
          <Input
            type="number"
            value={String(rect.height)}
            onChange={(event) => setRect({ ...rect, height: Number(event.target.value) })}
          />
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Pivot x (0–1)">
          <Input
            type="number"
            step={0.05}
            value={String(pivot.x)}
            onChange={(event) => setPivot({ ...pivot, x: Number(event.target.value) })}
          />
        </Field>
        <Field label="Pivot y (0–1)">
          <Input
            type="number"
            step={0.05}
            value={String(pivot.y)}
            onChange={(event) => setPivot({ ...pivot, y: Number(event.target.value) })}
          />
        </Field>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </Modal>
  );
}
