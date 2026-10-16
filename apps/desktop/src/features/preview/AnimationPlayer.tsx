import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react';
import type { AnimationDefinition, SpriteDefinition } from '@assets-pipeline/core';
import { useSourceImage } from '../canvas/useSourceImage.js';
import { findFrameAt, layoutAnimationFrames, totalDuration } from './pivot-math.js';

interface AnimationPlayerProps {
  readonly root: string;
  readonly path: string;
  readonly animationId: string;
  readonly animation: AnimationDefinition;
  readonly sprites: Readonly<Record<string, SpriteDefinition>>;
  readonly onBack: () => void;
}

export function AnimationPlayer({
  root,
  path,
  animationId,
  animation,
  sprites,
  onBack,
}: AnimationPlayerProps) {
  const { image, error } = useSourceImage(root, path);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [playing, setPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const [crops, setCrops] = useState<ReadonlyMap<string, ImageBitmap>>(new Map());
  const elapsedRef = useRef(0);
  const indexRef = useRef(0);

  const frames = animation.frames;
  const layout = useMemo(
    () =>
      layoutAnimationFrames(
        frames.map((frame) => {
          const sprite = sprites[frame.sprite];
          return {
            width: sprite?.width ?? 0,
            height: sprite?.height ?? 0,
            pivot: sprite?.pivot ?? { x: 0, y: 0 },
          };
        }),
      ),
    [frames, sprites],
  );
  const total = useMemo(() => totalDuration(frames), [frames]);

  // Crop one bitmap per distinct sprite in the animation. Bitmaps are only
  // closed on unmount so the redraw effect never draws a closed bitmap.
  const allCropsRef = useRef<ImageBitmap[]>([]);
  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    void (async () => {
      const next = new Map<string, ImageBitmap>();
      for (const frame of frames) {
        const sprite = sprites[frame.sprite];
        if (!sprite || next.has(frame.sprite)) continue;
        const bitmap = await createImageBitmap(
          image,
          sprite.x,
          sprite.y,
          sprite.width,
          sprite.height,
        );
        allCropsRef.current.push(bitmap);
        next.set(frame.sprite, bitmap);
      }
      if (!cancelled) setCrops(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [frames, image, sprites]);

  useEffect(() => {
    return () => {
      for (const bitmap of allCropsRef.current) bitmap.close();
      allCropsRef.current = [];
    };
  }, []);

  // Restart playback when the animation changes.
  useEffect(() => {
    elapsedRef.current = 0;
    indexRef.current = 0;
    setFrameIndex(0);
    setPlaying(true);
  }, [animationId]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Playback clock.
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      elapsedRef.current += now - last;
      last = now;
      const result = findFrameAt(frames, elapsedRef.current, animation.playback === 'loop');
      if (result.index !== indexRef.current) {
        indexRef.current = result.index;
        setFrameIndex(result.index);
      }
      if (result.finished) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animation.playback, frames, playing]);

  // Redraw the composition whenever the frame, crops or size change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(size.width * dpr);
    const height = Math.round(size.height * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);

    const frame = frames[Math.min(frameIndex, frames.length - 1)];
    if (!frame || layout.width === 0 || layout.height === 0) return;
    const zoom = Math.max(
      1,
      Math.min(
        16,
        Math.floor(Math.min((size.width - 48) / layout.width, (size.height - 48) / layout.height)),
      ),
    );
    const originX = Math.round((size.width - layout.width * zoom) / 2);
    const originY = Math.round((size.height - layout.height * zoom) / 2);
    const offset = layout.offsets[Math.min(frameIndex, layout.offsets.length - 1)];
    const crop = crops.get(frame.sprite);
    if (crop && offset) {
      context.imageSmoothingEnabled = false;
      context.drawImage(
        crop,
        originX + offset.x * zoom,
        originY + offset.y * zoom,
        crop.width * zoom,
        crop.height * zoom,
      );
    }

    // Shared pivot marker so misaligned frames are easy to spot.
    const pivotX = originX + layout.pivot.x * zoom + 0.5;
    const pivotY = originY + layout.pivot.y * zoom + 0.5;
    context.strokeStyle = 'rgba(242, 193, 78, 0.85)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(pivotX - 6, pivotY);
    context.lineTo(pivotX + 6, pivotY);
    context.moveTo(pivotX, pivotY - 6);
    context.lineTo(pivotX, pivotY + 6);
    context.stroke();
  }, [crops, frameIndex, frames, layout, size]);

  const restart = (): void => {
    elapsedRef.current = 0;
    indexRef.current = 0;
    setFrameIndex(0);
    setPlaying(true);
  };

  return (
    <div className="player">
      <header className="player-header">
        <button type="button" className="btn btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Volver al archivo
        </button>
        <span className="player-title mono" title={animationId}>
          {animationId}
        </span>
        <span className="player-meta">
          {animation.playback} · {frames.length} frames · {total} ms
        </span>
        <div className="player-controls">
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setPlaying((current) => !current)}
            disabled={
              frames.length === 0 ||
              (!playing && elapsedRef.current >= total && animation.playback === 'once')
            }
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? 'Pausar' : 'Reproducir'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={restart}
            disabled={frames.length === 0}
          >
            <RotateCcw size={14} /> Reiniciar
          </button>
        </div>
      </header>

      <div className="player-canvas" ref={wrapperRef}>
        {error ? <p className="form-error">{error}</p> : null}
        <canvas ref={canvasRef} className="player-layer" />
        <div className="player-frame-label">
          Frame {Math.min(frameIndex + 1, Math.max(frames.length, 1))}/{frames.length}
        </div>
      </div>

      <footer className="player-strip" role="list">
        {frames.map((frame, index) => (
          <button
            key={`${frame.sprite}-${index}`}
            type="button"
            role="listitem"
            className={`strip-frame${index === frameIndex ? ' is-current' : ''}`}
            onClick={() => {
              elapsedRef.current = frames
                .slice(0, index)
                .reduce((sum, item) => sum + item.durationMs, 0);
              indexRef.current = index;
              setFrameIndex(index);
              setPlaying(false);
            }}
          >
            <span className="strip-index">{index}</span>
            <span className="strip-sprite mono">{frame.sprite}</span>
            <span className="strip-duration">{frame.durationMs} ms</span>
          </button>
        ))}
      </footer>
    </div>
  );
}
