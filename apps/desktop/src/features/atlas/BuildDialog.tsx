import { useEffect, useState } from 'react';
import { Check } from 'pixelarticons/react/Check.js';
import { Download } from 'pixelarticons/react/Download.js';
import { WarningDiamond } from 'pixelarticons/react/WarningDiamond.js';
import { planAtlasBuild } from '@assets-pipeline/core';
import type { AtlasBuildPlan } from '@assets-pipeline/core';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/ui/pixelact-ui/input.js';
import { Modal } from '../../components/Modal.js';
import { Field } from '../../components/Field.js';
import { useToast } from '../../components/Toast.js';
import { call } from '../../adapters/tauri/commands.js';
import { describeError, useRepository } from '../project/repository-context.js';

interface BuildDialogProps {
  readonly onClose: () => void;
}

type PlanState =
  | { readonly status: 'ready'; readonly plan: AtlasBuildPlan }
  | { readonly status: 'error'; readonly message: string };

interface BuildOutcome {
  readonly output: string;
  readonly files: readonly string[];
}

export function BuildDialog({ onClose }: BuildDialogProps) {
  const { root, database, refresh } = useRepository();
  const toast = useToast();
  const [output, setOutput] = useState('dist/assets');
  const [planState, setPlanState] = useState<PlanState | null>(null);
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<BuildOutcome | null>(null);

  useEffect(() => {
    try {
      setPlanState({ status: 'ready', plan: planAtlasBuild(database) });
    } catch (error) {
      setPlanState({ status: 'error', message: describeError(error) });
    }
  }, [database]);

  const build = async (): Promise<void> => {
    if (!planState || planState.status !== 'ready') return;
    setBuilding(true);
    try {
      const outcome = await call<BuildOutcome>('build_atlases', {
        root,
        output,
        plan: planState.plan,
      });
      setResult(outcome);
      toast.success(`Build completado: ${outcome.files.length} archivos.`);
      await refresh();
    } catch (error) {
      toast.error(describeError(error));
    } finally {
      setBuilding(false);
    }
  };

  return (
    <Modal
      title="Generar atlas"
      onClose={onClose}
      width={720}
      footer={
        result ? (
          <>
            <Button onClick={() => void revealItemInDir(result.output).catch(() => undefined)}>
              Mostrar en el explorador
            </Button>
            <Button variant="primary" onClick={onClose}>
              Cerrar
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose} disabled={building}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={building || planState?.status !== 'ready'}
              onClick={() => void build()}
            >
              <Download width={24} height={24} /> {building ? 'Generando…' : 'Generar'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="build-result">
          <p className="build-ok">
            <Check width={24} height={24} /> Build completado en <code>{result.output}</code>
          </p>
          <ul className="build-files">
            {result.files.map((file) => (
              <li key={file}>
                <code>{file}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <Field
            label="Carpeta de salida"
            hint="Subcarpeta del repositorio, igual que `assets-pipeline build --output`."
          >
            <Input
              className="mono"
              value={output}
              disabled={building}
              onChange={(event) => setOutput(event.target.value)}
            />
          </Field>
          <PlanSummary state={planState} />
        </>
      )}
    </Modal>
  );
}

function PlanSummary({ state }: { state: PlanState | null }) {
  if (!state) return null;
  if (state.status === 'error') {
    return (
      <div className="plan-check is-error">
        <WarningDiamond width={24} height={24} />
        <p>{state.message}</p>
      </div>
    );
  }
  const pages = state.plan.pages;
  const sprites = pages.reduce((total, page) => total + page.sprites.length, 0);
  const animations = pages.reduce((total, page) => total + page.animations.length, 0);
  return (
    <div className="plan-check is-ok plan-check-build">
      <Check width={24} height={24} />
      <div>
        <p>
          Listo para construir: {pages.length} página(s), {sprites} sprites, {animations}{' '}
          animaciones.
        </p>
        <ul className="plan-check-pages">
          {pages.map((page) => (
            <li key={page.fileName}>
              <code>{page.fileName}</code> · {page.sprites.length} sprites ·{' '}
              {page.animations.length} animaciones
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
