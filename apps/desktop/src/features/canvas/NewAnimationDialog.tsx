import { useState } from 'react';
import { ArrowDown } from 'pixelarticons/react/ArrowDown.js';
import { ArrowUp } from 'pixelarticons/react/ArrowUp.js';
import { Close } from 'pixelarticons/react/Close.js';
import { Plus } from 'pixelarticons/react/Plus.js';
import { PipelineError, assertDuration, assertIdentifier } from '@assets-pipeline/core';
import type { SpriteDefinition } from '@assets-pipeline/core';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/ui/pixelact-ui/input.js';
import { Modal } from '../../components/Modal.js';
import { Field } from '../../components/Field.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/pixelact-ui/select.js';
import { moveItem } from '../preview/frame-sequence.js';

export interface AnimationFrameInput {
  readonly sprite: string;
  readonly durationMs: number;
}

interface NewAnimationDialogProps {
  readonly sprites: Readonly<Record<string, SpriteDefinition>>;
  readonly spriteIds: readonly string[];
  readonly onSubmit: (
    id: string,
    playback: 'loop' | 'once',
    frames: readonly AnimationFrameInput[],
  ) => Promise<boolean>;
  readonly onClose: () => void;
}

export function NewAnimationDialog({
  sprites,
  spriteIds,
  onSubmit,
  onClose,
}: NewAnimationDialogProps) {
  const [id, setId] = useState('');
  const [playback, setPlayback] = useState<'loop' | 'once'>('loop');
  const [frames, setFrames] = useState<readonly AnimationFrameInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lastDuration = frames.length > 0 ? frames[frames.length - 1]!.durationMs : 100;

  const appendFrame = (sprite: string): void => {
    setFrames((current) => [...current, { sprite, durationMs: lastDuration }]);
  };

  const updateFrame = (index: number, patch: Partial<AnimationFrameInput>): void => {
    setFrames((current) =>
      current.map((frame, position) => (position === index ? { ...frame, ...patch } : frame)),
    );
  };

  const moveFrame = (index: number, direction: -1 | 1): void => {
    setFrames((current) => moveItem(current, index, index + direction));
  };

  const submit = async (): Promise<void> => {
    setError(null);
    try {
      assertIdentifier(id);
      if (frames.length === 0) {
        throw new PipelineError('INVALID_INPUT', 'Añade al menos un frame a la animación.');
      }
      for (const frame of frames) assertDuration(frame.durationMs);
    } catch (caught) {
      setError(caught instanceof PipelineError ? caught.message : String(caught));
      return;
    }
    setBusy(true);
    const ok = await onSubmit(id, playback, frames);
    setBusy(false);
    if (ok) onClose();
    else setError('No se pudo crear la animación (revisa el aviso de error).');
  };

  return (
    <Modal
      title="Nueva animación"
      onClose={onClose}
      width={820}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Creando…' : 'Crear animación'}
          </Button>
        </>
      }
    >
      <div className="animation-form">
        <div className="grid-2">
          <Field label="ID de la animación">
            <Input
              className="mono"
              value={id}
              autoFocus
              placeholder="npc/walk"
              onChange={(event) => setId(event.target.value)}
            />
          </Field>
          <Field label="Reproducción" hint="loop = bucle continuo · once = una sola vez">
            <Select
              value={playback}
              onValueChange={(value) => setPlayback(value === 'once' ? 'once' : 'loop')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loop" className="pixel-font text-[10px]">
                  loop
                </SelectItem>
                <SelectItem value="once" className="pixel-font text-[10px]">
                  once
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="animation-columns">
          <div className="animation-column">
            <h4>Sprites disponibles</h4>
            <ul className="picker-list">
              {spriteIds.map((spriteId) => {
                const sprite = sprites[spriteId]!;
                return (
                  <li key={spriteId}>
                    <button
                      type="button"
                      className="picker-item"
                      onClick={() => appendFrame(spriteId)}
                    >
                      <span className="mono">{spriteId}</span>
                      <span className="picker-meta">
                        {sprite.width}×{sprite.height}
                      </span>
                      <Plus width={24} height={24} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="animation-column">
            <h4>Secuencia ({frames.length})</h4>
            {frames.length === 0 ? (
              <p className="side-placeholder">Haz clic en los sprites para añadirlos en orden.</p>
            ) : (
              <ol className="sequence-list">
                {frames.map((frame, index) => (
                  <li key={`${frame.sprite}-${index}`} className="sequence-item">
                    <span className="sequence-index">{index}</span>
                    <span className="sequence-sprite mono">{frame.sprite}</span>
                    <Input
                      className="sequence-duration"
                      type="number"
                      min={1}
                      value={String(frame.durationMs)}
                      title="Duración en milisegundos"
                      onChange={(event) =>
                        updateFrame(index, { durationMs: Number(event.target.value) })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Subir"
                      disabled={index === 0}
                      onClick={() => moveFrame(index, -1)}
                    >
                      <ArrowUp width={24} height={24} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Bajar"
                      disabled={index === frames.length - 1}
                      onClick={() => moveFrame(index, 1)}
                    >
                      <ArrowDown width={24} height={24} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar"
                      onClick={() =>
                        setFrames((current) => current.filter((_, position) => position !== index))
                      }
                    >
                      <Close width={24} height={24} />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
      </div>
    </Modal>
  );
}
