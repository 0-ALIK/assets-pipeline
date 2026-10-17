import { useState } from 'react';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/ui/pixelact-ui/input.js';
import { Modal } from '../../components/Modal.js';
import { Field } from '../../components/Field.js';
import type { SpriteDefinition } from '@assets-pipeline/core';

interface AddFrameDialogProps {
  readonly sprites: Readonly<Record<string, SpriteDefinition>>;
  readonly spriteIds: readonly string[];
  /** null appends at the end; a number inserts before that frame. */
  readonly insertAt: number | null;
  readonly defaultDuration: number;
  readonly busy: boolean;
  readonly onPick: (sprite: string, durationMs: number) => void;
  readonly onClose: () => void;
}

export function AddFrameDialog({
  sprites,
  spriteIds,
  insertAt,
  defaultDuration,
  busy,
  onPick,
  onClose,
}: AddFrameDialogProps) {
  const [duration, setDuration] = useState(String(Math.max(1, defaultDuration)));
  const parsedDuration = Number(duration);
  const durationValid = Number.isInteger(parsedDuration) && parsedDuration > 0;

  return (
    <Modal
      title={
        insertAt === null ? 'Añadir frame al final' : `Insertar frame en la posición ${insertAt}`
      }
      onClose={onClose}
      width={560}
      footer={<Button onClick={onClose}>Cerrar</Button>}
    >
      <Field label="Duración (ms)" hint="Se aplica a cada sprite que añadas desde aquí.">
        <Input
          type="number"
          min={1}
          value={duration}
          autoFocus
          onChange={(event) => setDuration(event.target.value)}
        />
      </Field>
      <ul className="picker-list picker-list-dialog">
        {spriteIds.map((spriteId) => {
          const sprite = sprites[spriteId]!;
          return (
            <li key={spriteId}>
              <button
                type="button"
                className="picker-item"
                disabled={busy || !durationValid}
                onClick={() => onPick(spriteId, parsedDuration)}
              >
                <span className="mono">{spriteId}</span>
                <span className="picker-meta">
                  {sprite.width}×{sprite.height}
                </span>
                <span className="picker-add">Añadir</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
