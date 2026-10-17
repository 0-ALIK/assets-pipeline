import { useEffect, useMemo, useState } from 'react';
import { Check } from 'pixelarticons/react/Check.js';
import { Database } from 'pixelarticons/react/Database.js';
import { Delete } from 'pixelarticons/react/Delete.js';
import { Plus } from 'pixelarticons/react/Plus.js';
import { WarningDiamond } from 'pixelarticons/react/WarningDiamond.js';
import {
  PipelineError,
  assertAtlasGap,
  assertAtlasName,
  assertAtlasSize,
  planAtlasBuild,
} from '@assets-pipeline/core';
import type { AtlasBuildPlan } from '@assets-pipeline/core';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/ui/pixelact-ui/input.js';
import { Spinner as PixelSpinner } from '../../components/ui/pixelact-ui/spinner.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/pixelact-ui/select.js';
import { Modal } from '../../components/Modal.js';
import { Field } from '../../components/Field.js';
import { useToast } from '../../components/Toast.js';
import { askConfirmation } from '../../adapters/tauri/dialogs.js';
import { describeError, useRepository } from '../project/repository-context.js';
import { deriveGroups, listAtlases } from './atlas-state.js';
import type { AtlasInfo, GroupInfo } from './atlas-state.js';

type PlanCheck =
  | { readonly status: 'ready'; readonly plan: AtlasBuildPlan }
  | { readonly status: 'error'; readonly message: string };

const noAtlasValue = '__none__';

export function AtlasScreen() {
  const { database, mutate, busy } = useRepository();
  const toast = useToast();
  const groups = useMemo(() => deriveGroups(database), [database]);
  const atlases = useMemo(() => listAtlases(database), [database]);
  const knownGroups = useMemo(() => new Set(groups.map((group) => group.name)), [groups]);
  const unassigned = groups.filter((group) => group.atlas === null);
  const [newOpen, setNewOpen] = useState(false);
  const [planCheck, setPlanCheck] = useState<PlanCheck | null>(null);

  // The same planner the build command uses, so problems show up before building.
  useEffect(() => {
    try {
      setPlanCheck({ status: 'ready', plan: planAtlasBuild(database) });
    } catch (error) {
      setPlanCheck({ status: 'error', message: describeError(error) });
    }
  }, [database]);

  const assign = async (group: GroupInfo, target: string): Promise<void> => {
    if (target === (group.atlas ?? '')) return;
    const ok = await mutate(async (workspace) => {
      if (group.atlas) await workspace.unassignGroup(group.atlas, group.name);
      if (target !== '') await workspace.assignGroup(target, group.name);
    });
    if (ok) {
      toast.success(
        target === '' ? `Grupo ${group.name} sin atlas.` : `Grupo ${group.name} → ${target}.`,
      );
    }
  };

  const saveAtlas = async (atlas: AtlasInfo, size: number, gap: number): Promise<void> => {
    try {
      assertAtlasSize(size);
      assertAtlasGap(gap, size);
    } catch (caught) {
      toast.error(describeError(caught));
      return;
    }
    const ok = await mutate((workspace) => workspace.setAtlas(atlas.name, size, gap));
    if (ok) toast.success(`Atlas actualizado: ${atlas.name}`);
  };

  const removeAtlas = async (atlas: AtlasInfo): Promise<void> => {
    const detail =
      atlas.groups.length > 0 ? ` Sus ${atlas.groups.length} grupo(s) quedarán sin atlas.` : '';
    const confirmed = await askConfirmation(
      'Eliminar atlas',
      `Se eliminará la configuración del atlas ${atlas.name}.${detail}`,
    );
    if (!confirmed) return;
    const ok = await mutate((workspace) => workspace.removeAtlas(atlas.name));
    if (ok) toast.success(`Atlas eliminado: ${atlas.name}`);
  };

  return (
    <section className="atlas-screen">
      <header className="atlas-toolbar">
        <div>
          <h2>Atlas</h2>
          <p className="atlas-summary">
            {atlases.length} atlas · {groups.length} grupos · {unassigned.length} sin asignar
          </p>
        </div>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => setNewOpen(true)}>
          <Plus width={24} height={24} /> Nuevo atlas
        </Button>
      </header>

      <div className="atlas-columns">
        <section className="atlas-column" aria-label="Configuración de atlas">
          <h3 className="atlas-heading">
            <Database width={20} height={20} /> Configuración
          </h3>
          {atlases.length === 0 ? (
            <p className="side-placeholder">
              No hay atlas configurados. Crea uno y asígnale grupos para poder construir.
            </p>
          ) : (
            atlases.map((atlas) => (
              <AtlasCard
                key={atlas.name}
                atlas={atlas}
                knownGroups={knownGroups}
                busy={busy}
                onSave={(size, gap) => void saveAtlas(atlas, size, gap)}
                onRemove={() => void removeAtlas(atlas)}
              />
            ))
          )}
        </section>

        <section className="atlas-column" aria-label="Grupos y comprobación">
          <h3 className="atlas-heading">Grupos</h3>
          {groups.length === 0 ? (
            <p className="side-placeholder">
              Todavía no hay sprites: los grupos se derivan del primer segmento de cada ID.
            </p>
          ) : (
            <ul className="group-list">
              {groups.map((group) => (
                <li
                  key={group.name}
                  className={`group-row${group.atlas === null ? ' is-unassigned' : ''}`}
                >
                  <span className="group-name mono">{group.name}</span>
                  <span className="group-meta">{group.spriteIds.length} sprites</span>
                  <div className="group-select">
                    <Select
                      value={group.atlas ?? noAtlasValue}
                      disabled={busy}
                      onValueChange={(value) =>
                        void assign(group, value === noAtlasValue ? '' : value)
                      }
                    >
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={noAtlasValue} className="pixel-font text-[10px]">
                          Sin asignar
                        </SelectItem>
                        {atlases.map((atlas) => (
                          <SelectItem
                            key={atlas.name}
                            value={atlas.name}
                            className="pixel-font text-[10px]"
                          >
                            {atlas.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3 className="atlas-heading">Comprobación</h3>
          <PlanCheckPanel check={planCheck} />
        </section>
      </div>

      {newOpen ? (
        <NewAtlasDialog
          busy={busy}
          onSubmit={async (name, size, gap) => {
            const ok = await mutate((workspace) => workspace.addAtlas(name, size, gap));
            if (ok) toast.success(`Atlas creado: ${name}`);
            return ok;
          }}
          onClose={() => setNewOpen(false)}
        />
      ) : null}
    </section>
  );
}

interface AtlasCardProps {
  readonly atlas: AtlasInfo;
  readonly knownGroups: ReadonlySet<string>;
  readonly busy: boolean;
  readonly onSave: (size: number, gap: number) => void;
  readonly onRemove: () => void;
}

function AtlasCard({ atlas, knownGroups, busy, onSave, onRemove }: AtlasCardProps) {
  const [size, setSize] = useState(String(atlas.size));
  const [gap, setGap] = useState(String(atlas.gap));

  useEffect(() => {
    setSize(String(atlas.size));
    setGap(String(atlas.gap));
  }, [atlas.size, atlas.gap]);

  const dirty = Number(size) !== atlas.size || Number(gap) !== atlas.gap;

  return (
    <article className="atlas-card">
      <header className="atlas-card-header">
        <h4>{atlas.name}</h4>
        <span className="atlas-card-meta">
          {atlas.spriteCount} sprites · {atlas.groups.length} grupos
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Eliminar atlas"
          aria-label={`Eliminar atlas ${atlas.name}`}
          disabled={busy}
          onClick={onRemove}
        >
          <Delete width={24} height={24} />
        </Button>
      </header>
      <div className="atlas-edit-row">
        <label className="field inline-field">
          <span className="field-label">Tamaño</span>
          <Input
            type="number"
            min={1}
            max={8192}
            value={size}
            disabled={busy}
            onChange={(event) => setSize(event.target.value)}
          />
        </label>
        <label className="field inline-field">
          <span className="field-label">Gap</span>
          <Input
            type="number"
            min={0}
            value={gap}
            disabled={busy}
            onChange={(event) => setGap(event.target.value)}
          />
        </label>
        <Button
          size="sm"
          disabled={busy || !dirty}
          onClick={() => onSave(Number(size), Number(gap))}
        >
          Guardar
        </Button>
      </div>
      {atlas.groups.length > 0 ? (
        <ul className="atlas-chips">
          {atlas.groups.map((group) => (
            <li
              key={group}
              className={`group-chip${knownGroups.has(group) ? '' : ' is-stale'}`}
              title={
                knownGroups.has(group)
                  ? undefined
                  : 'Este grupo ya no existe entre los IDs actuales'
              }
            >
              {knownGroups.has(group) ? null : <WarningDiamond width={16} height={16} />}
              {group}
            </li>
          ))}
        </ul>
      ) : (
        <p className="atlas-empty-note">Sin grupos asignados.</p>
      )}
    </article>
  );
}

function PlanCheckPanel({ check }: { check: PlanCheck | null }) {
  if (!check) {
    return (
      <div className="plan-check">
        <PixelSpinner width={24} height={24} />
        <p>Comprobando…</p>
      </div>
    );
  }
  if (check.status === 'error') {
    return (
      <div className="plan-check is-error">
        <WarningDiamond width={24} height={24} />
        <p>{check.message}</p>
      </div>
    );
  }
  const pages = check.plan.pages;
  const sprites = pages.reduce((total, page) => total + page.sprites.length, 0);
  const animations = pages.reduce((total, page) => total + page.animations.length, 0);
  const byAtlas = new Map<string, number>();
  for (const page of pages) {
    byAtlas.set(page.atlas, (byAtlas.get(page.atlas) ?? 0) + 1);
  }
  return (
    <div className="plan-check is-ok">
      <Check width={24} height={24} />
      <div>
        <p>
          Listo para construir: {pages.length} página(s), {sprites} sprites, {animations}{' '}
          animaciones.
        </p>
        <ul className="plan-check-pages">
          {[...byAtlas.entries()].map(([atlas, count]) => (
            <li key={atlas}>
              <code>{atlas}</code>: {count} página(s)
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface NewAtlasDialogProps {
  readonly busy: boolean;
  readonly onSubmit: (name: string, size: number, gap: number) => Promise<boolean>;
  readonly onClose: () => void;
}

function NewAtlasDialog({ busy, onSubmit, onClose }: NewAtlasDialogProps) {
  const [name, setName] = useState('');
  const [size, setSize] = useState('2048');
  const [gap, setGap] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const submit = async (): Promise<void> => {
    setError(null);
    try {
      assertAtlasName(name);
      assertAtlasSize(Number(size));
      assertAtlasGap(Number(gap), Number(size));
    } catch (caught) {
      setError(caught instanceof PipelineError ? caught.message : String(caught));
      return;
    }
    setWorking(true);
    const ok = await onSubmit(name, Number(size), Number(gap));
    setWorking(false);
    if (ok) onClose();
    else setError('No se pudo crear el atlas (revisa el aviso de error).');
  };

  return (
    <Modal
      title="Nuevo atlas"
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button onClick={onClose} disabled={working || busy}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={working || busy}>
            {working ? 'Creando…' : 'Crear atlas'}
          </Button>
        </>
      }
    >
      <Field
        label="Nombre"
        hint="Letras, números, guiones y guiones bajos. Sin rutas ni extensión."
      >
        <Input
          className="mono"
          value={name}
          autoFocus
          placeholder="characters"
          onChange={(event) => setName(event.target.value)}
        />
      </Field>
      <div className="grid-2">
        <Field label="Tamaño (px)" hint="Ancho y alto de cada página; entero entre 1 y 8192.">
          <Input
            type="number"
            min={1}
            max={8192}
            value={size}
            onChange={(event) => setSize(event.target.value)}
          />
        </Field>
        <Field
          label="Gap (px)"
          hint="Espacio transparente entre sprites y filas; menor que el tamaño."
        >
          <Input
            type="number"
            min={0}
            value={gap}
            onChange={(event) => setGap(event.target.value)}
          />
        </Field>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </Modal>
  );
}
