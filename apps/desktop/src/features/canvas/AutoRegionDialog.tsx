import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'pixelarticons/react/Sparkles.js';
import { WarningDiamond } from 'pixelarticons/react/WarningDiamond.js';
import { PipelineError } from '@assets-pipeline/core';
import type { AutoRegionPlan } from '@assets-pipeline/core';
import { Button } from '../../components/Button.js';
import { Field } from '../../components/Field.js';
import { Modal } from '../../components/Modal.js';
import { useToast } from '../../components/Toast.js';
import { Input } from '../../components/ui/pixelact-ui/input.js';
import { Spinner } from '../../components/ui/pixelact-ui/spinner.js';
import { useRepository } from '../project/repository-context.js';

interface AutoRegionDialogProps {
  readonly path: string;
  readonly onApply: (padding: number) => Promise<boolean>;
  readonly onClose: () => void;
}

const previewLimit = 20;

/** Warning + dry-run preview for the automatic region generator. */
export function AutoRegionDialog({ path, onApply, onClose }: AutoRegionDialogProps) {
  const { workspace, busy } = useRepository();
  const toast = useToast();
  const [padding, setPadding] = useState('0');
  const [plan, setPlan] = useState<AutoRegionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(true);
  const [working, setWorking] = useState(false);
  const request = useRef(0);

  const parsedPadding = Number(padding);
  const validPadding =
    padding.trim() !== '' && Number.isInteger(parsedPadding) && parsedPadding >= 0;

  useEffect(() => {
    const token = ++request.current;
    if (!validPadding) {
      setPlan(null);
      setError('El padding debe ser un entero desde 0.');
      setComputing(false);
      return;
    }
    setComputing(true);
    setError(null);
    const timer = window.setTimeout(() => {
      void workspace
        .autoRegionSprites(path, { padding: parsedPadding, dryRun: true })
        .then((next) => {
          if (token === request.current) setPlan(next);
        })
        .catch((caught: unknown) => {
          if (token === request.current) {
            setPlan(null);
            setError(caught instanceof PipelineError ? caught.message : String(caught));
          }
        })
        .finally(() => {
          if (token === request.current) setComputing(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      request.current += 1;
    };
  }, [parsedPadding, path, validPadding, workspace]);

  const apply = async (): Promise<void> => {
    if (!plan || plan.sprites.length === 0) return;
    setWorking(true);
    setError(null);
    const ok = await onApply(parsedPadding);
    setWorking(false);
    if (ok) {
      toast.success(`Regiones creadas: ${plan.sprites.length} en «${plan.group}»`);
      onClose();
    }
  };

  return (
    <Modal
      title="Regiones automáticas"
      onClose={onClose}
      width={620}
      footer={
        <>
          <Button onClick={onClose} disabled={working}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => void apply()}
            disabled={working || busy || computing || !plan || plan.sprites.length === 0}
          >
            {working ? 'Aplicando…' : 'Aplicar'}
          </Button>
        </>
      }
    >
      <p className="plan-warning">
        <WarningDiamond width={24} height={24} /> Aviso: este generador no respeta la lógica de tus
        sprites. Crea una región por cada zona de contenido opaco, incluidas partes sueltas, sombras
        o píxeles aislados. Las definiciones existentes se conservan y las nuevas nunca se solapan.
      </p>
      <Field
        label="Padding (px)"
        hint="Margen alrededor de cada región detectada. Se recorta si choca con otra región."
      >
        <Input
          type="number"
          min={0}
          step={1}
          value={padding}
          onChange={(event) => setPadding(event.target.value)}
        />
      </Field>
      <div className="auto-region-preview">
        {computing ? (
          <p className="auto-region-status">
            <Spinner width={24} height={24} aria-label="Analizando contenido" /> Analizando el
            contenido del archivo…
          </p>
        ) : error ? (
          <p className="form-error">{error}</p>
        ) : plan && plan.sprites.length === 0 ? (
          <p className="auto-region-status">
            No se detectó contenido nuevo para regionar
            {plan.skipped > 0 ? ` (${plan.skipped} zonas ya cubiertas)` : ''}.
          </p>
        ) : plan ? (
          <>
            <p className="auto-region-summary">
              <Sparkles width={24} height={24} />
              <span>
                <strong>{plan.sprites.length}</strong> regiones en «{plan.group}» · pivot 0.5,1
                {plan.skipped > 0 ? ` · ${plan.skipped} omitidas por definiciones existentes` : ''}
              </span>
            </p>
            <ul className="auto-region-list">
              {plan.sprites.slice(0, previewLimit).map((sprite) => (
                <li key={sprite.id} className="mono">
                  <span>{sprite.id}</span>
                  <span>
                    x={sprite.rect.x} y={sprite.rect.y} {sprite.rect.width}×{sprite.rect.height}
                  </span>
                </li>
              ))}
              {plan.sprites.length > previewLimit ? (
                <li className="mono">… y {plan.sprites.length - previewLimit} más</li>
              ) : null}
            </ul>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
