import { useEffect, useState } from 'react';
import { ChevronLeft } from 'pixelarticons/react/ChevronLeft.js';
import { ChevronRight } from 'pixelarticons/react/ChevronRight.js';
import { Close } from 'pixelarticons/react/Close.js';
import { Copy } from 'pixelarticons/react/Copy.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/ui/pixelact-ui/input.js';
import type { AnimationFrame } from '@assets-pipeline/core';

interface FrameStripProps {
  readonly frames: readonly AnimationFrame[];
  readonly currentIndex: number;
  readonly busy: boolean;
  readonly onSelect: (index: number) => void;
  readonly onDuration: (index: number, durationMs: number) => void;
  readonly onMove: (from: number, to: number) => void;
  readonly onDuplicate: (index: number) => void;
  readonly onRemove: (index: number) => void;
  readonly onInsertBefore: (index: number) => void;
  readonly onAppend: () => void;
}

export function FrameStrip({
  frames,
  currentIndex,
  busy,
  onSelect,
  onDuration,
  onMove,
  onDuplicate,
  onRemove,
  onInsertBefore,
  onAppend,
}: FrameStripProps) {
  return (
    <footer className="player-strip" role="list">
      {frames.map((frame, index) => (
        <FrameChip
          key={`${frame.sprite}-${index}`}
          frame={frame}
          index={index}
          total={frames.length}
          current={index === currentIndex}
          busy={busy}
          onSelect={onSelect}
          onDuration={onDuration}
          onMove={onMove}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onInsertBefore={onInsertBefore}
        />
      ))}
      <button
        type="button"
        className="strip-add"
        onClick={onAppend}
        disabled={busy}
        title="Añadir frame al final"
      >
        + frame
      </button>
    </footer>
  );
}

interface FrameChipProps {
  readonly frame: AnimationFrame;
  readonly index: number;
  readonly total: number;
  readonly current: boolean;
  readonly busy: boolean;
  readonly onSelect: (index: number) => void;
  readonly onDuration: (index: number, durationMs: number) => void;
  readonly onMove: (from: number, to: number) => void;
  readonly onDuplicate: (index: number) => void;
  readonly onRemove: (index: number) => void;
  readonly onInsertBefore: (index: number) => void;
}

function FrameChip({
  frame,
  index,
  total,
  current,
  busy,
  onSelect,
  onDuration,
  onMove,
  onDuplicate,
  onRemove,
  onInsertBefore,
}: FrameChipProps) {
  const [duration, setDuration] = useState(String(frame.durationMs));

  useEffect(() => {
    setDuration(String(frame.durationMs));
  }, [frame.durationMs]);

  const commitDuration = (): void => {
    const value = Number(duration);
    if (Number.isInteger(value) && value > 0 && value !== frame.durationMs) {
      onDuration(index, value);
    } else {
      setDuration(String(frame.durationMs));
    }
  };

  return (
    <div className={`strip-frame${current ? ' is-current' : ''}`} role="listitem">
      <button type="button" className="strip-main" onClick={() => onSelect(index)}>
        <span className="strip-index">#{index}</span>
        <span className="strip-sprite mono" title={frame.sprite}>
          {frame.sprite}
        </span>
      </button>
      <div className="strip-controls">
        <Input
          className="strip-duration-input"
          type="number"
          min={1}
          value={duration}
          title="Duración en milisegundos"
          disabled={busy}
          onChange={(event) => setDuration(event.target.value)}
          onBlur={commitDuration}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitDuration();
          }}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          title="Insertar un frame antes"
          aria-label="Insertar un frame antes"
          disabled={busy}
          onClick={() => onInsertBefore(index)}
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Mover a la izquierda"
          aria-label="Mover a la izquierda"
          disabled={busy || index === 0}
          onClick={() => onMove(index, index - 1)}
        >
          <ChevronLeft width={24} height={24} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Mover a la derecha"
          aria-label="Mover a la derecha"
          disabled={busy || index === total - 1}
          onClick={() => onMove(index, index + 1)}
        >
          <ChevronRight width={24} height={24} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Duplicar este frame"
          aria-label="Duplicar este frame"
          disabled={busy}
          onClick={() => onDuplicate(index)}
        >
          <Copy width={24} height={24} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Eliminar este frame"
          aria-label="Eliminar este frame"
          disabled={busy || total <= 1}
          onClick={() => onRemove(index)}
        >
          <Close width={24} height={24} />
        </Button>
      </div>
    </div>
  );
}
