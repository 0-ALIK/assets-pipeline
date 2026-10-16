import { useEffect, useState } from 'react';
import {
  PipelineError,
  assertIdentifier,
  assertPivot,
  assertRectangle,
} from '@assets-pipeline/core';
import { Modal } from '../../components/Modal.js';
import { Field } from '../../components/Field.js';
import type { Pivot, Rect } from './sprite-editor.js';

interface NewSpriteDialogProps {
  readonly initialRect: Rect | null;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly onRequestDraw: () => void;
  readonly onSubmit: (id: string, rect: Rect, pivot: Pivot) => Promise<boolean>;
  readonly onClose: () => void;
}

export function NewSpriteDialog({
  initialRect,
  imageWidth,
  imageHeight,
  onRequestDraw,
  onSubmit,
  onClose,
}: NewSpriteDialogProps) {
  const defaultWidth = Math.max(1, Math.min(32, imageWidth || 32));
  const defaultHeight = Math.max(1, Math.min(32, imageHeight || 32));
  const [id, setId] = useState('');
  const [rect, setRect] = useState<Rect>(
    initialRect ?? { x: 0, y: 0, width: defaultWidth, height: defaultHeight },
  );
  const [pivot, setPivot] = useState<Pivot>({ x: 0.5, y: 1 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialRect) setRect(initialRect);
  }, [initialRect]);

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
    setBusy(true);
    const ok = await onSubmit(id, rect, pivot);
    setBusy(false);
    if (ok) onClose();
  };

  const numberValue = (value: number): string => String(value);

  return (
    <Modal
      title="Nuevo sprite"
      onClose={onClose}
      width={560}
      footer={
        <>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => {
              onClose();
              onRequestDraw();
            }}
          >
            Dibujar en el lienzo
          </button>
          <span className="footer-spacer" />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? 'Creando…' : 'Crear sprite'}
          </button>
        </>
      }
    >
      <Field
        label="ID"
        hint="Segmentos separados por /. El primer segmento define el grupo del atlas."
      >
        <input
          className="input mono"
          value={id}
          autoFocus
          placeholder="npc/head/front/idle_0"
          onChange={(event) => setId(event.target.value)}
        />
      </Field>
      <div className="grid-4">
        <Field label="x">
          <input
            className="input"
            type="number"
            value={numberValue(rect.x)}
            onChange={(event) => setRect({ ...rect, x: Number(event.target.value) })}
          />
        </Field>
        <Field label="y">
          <input
            className="input"
            type="number"
            value={numberValue(rect.y)}
            onChange={(event) => setRect({ ...rect, y: Number(event.target.value) })}
          />
        </Field>
        <Field label="Ancho">
          <input
            className="input"
            type="number"
            value={numberValue(rect.width)}
            onChange={(event) => setRect({ ...rect, width: Number(event.target.value) })}
          />
        </Field>
        <Field label="Alto">
          <input
            className="input"
            type="number"
            value={numberValue(rect.height)}
            onChange={(event) => setRect({ ...rect, height: Number(event.target.value) })}
          />
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Pivot x (0–1)">
          <input
            className="input"
            type="number"
            step={0.05}
            value={numberValue(pivot.x)}
            onChange={(event) => setPivot({ ...pivot, x: Number(event.target.value) })}
          />
        </Field>
        <Field label="Pivot y (0–1)">
          <input
            className="input"
            type="number"
            step={0.05}
            value={numberValue(pivot.y)}
            onChange={(event) => setPivot({ ...pivot, y: Number(event.target.value) })}
          />
        </Field>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </Modal>
  );
}
