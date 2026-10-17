import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'pixelarticons/react/ChevronDown.js';
import { ChevronRight } from 'pixelarticons/react/ChevronRight.js';
import { Delete } from 'pixelarticons/react/Delete.js';
import { File } from 'pixelarticons/react/File.js';
import { Folder } from 'pixelarticons/react/Folder.js';
import { FolderPlus } from 'pixelarticons/react/FolderPlus.js';
import { Image } from 'pixelarticons/react/Image.js';
import { Link } from 'pixelarticons/react/Link.js';
import { MoreHorizontal } from 'pixelarticons/react/MoreHorizontal.js';
import { Move } from 'pixelarticons/react/Move.js';
import { Pencil } from 'pixelarticons/react/Pencil.js';
import { Reload } from 'pixelarticons/react/Reload.js';
import { WarningDiamond } from 'pixelarticons/react/WarningDiamond.js';
import { isSupportedSource } from '@assets-pipeline/core';
import { Button } from '../../components/Button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu.js';
import { useRepository } from '../project/repository-context.js';
import { ancestorDirectories, buildFileTree } from './tree.js';
import type { TreeNode } from './tree.js';
import { MoveDialog, NewFolderDialog, RemoveDialog, RenameDialog } from './FsDialogs.js';

interface ExplorerPanelProps {
  readonly selectedPath: string | null;
  readonly onSelect: (path: string | null) => void;
}

type DialogState =
  | { readonly kind: 'new-folder'; readonly parent: string }
  | { readonly kind: 'rename'; readonly path: string }
  | { readonly kind: 'move'; readonly path: string }
  | { readonly kind: 'remove'; readonly path: string }
  | null;

interface SourceCounts {
  readonly sprites: number;
  readonly animations: number;
}

export function ExplorerPanel({ selectedPath, onSelect }: ExplorerPanelProps) {
  const { files, database, busy, refresh } = useRepository();
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    if (!selectedPath) return;
    setExpanded((current) => {
      const next = new Set(current);
      for (const ancestor of ancestorDirectories(selectedPath)) next.add(ancestor);
      return next;
    });
  }, [selectedPath]);

  const toggle = (path: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const countsOf = (path: string): SourceCounts => {
    const source = database.sources[path];
    return {
      sprites: source ? Object.keys(source.sprites).length : 0,
      animations: source ? Object.keys(source.animations).length : 0,
    };
  };

  const handleAction = (kind: 'new-folder' | 'rename' | 'move' | 'remove', path: string): void => {
    if (kind === 'new-folder') setDialog({ kind: 'new-folder', parent: path });
    else if (kind === 'rename') setDialog({ kind: 'rename', path });
    else if (kind === 'move') setDialog({ kind: 'move', path });
    else setDialog({ kind: 'remove', path });
  };

  return (
    <aside className="explorer-panel" aria-label="Archivos del repositorio">
      <div className="explorer-toolbar">
        <span className="explorer-title">Archivos</span>
        <div className="explorer-toolbar-actions">
          <Button
            size="sm"
            onClick={() => setDialog({ kind: 'new-folder', parent: '' })}
            title="Crear una carpeta"
          >
            <FolderPlus width={24} height={24} /> Carpeta
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Recargar archivos"
            title="Recargar archivos"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <Reload width={24} height={24} />
          </Button>
        </div>
      </div>

      <div className="explorer-tree" role="tree">
        {tree.length === 0 ? (
          <p className="explorer-placeholder">
            El repositorio todavía no tiene archivos. Crea carpetas y añade tus PNG o Aseprite.
          </p>
        ) : (
          tree.map((node) => (
            <TreeRow
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              selectedPath={selectedPath}
              toggle={toggle}
              onSelect={onSelect}
              onAction={handleAction}
              countsOf={countsOf}
            />
          ))
        )}
      </div>

      <footer className="explorer-legend">
        <span className="def-dot" aria-hidden="true" />
        <span>con definiciones</span>
        <span className="legend-sep" aria-hidden="true" />
        <WarningDiamond width={16} height={16} aria-hidden="true" />
        <span>sin archivo</span>
      </footer>

      {dialog?.kind === 'new-folder' ? (
        <NewFolderDialog parent={dialog.parent} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'rename' ? (
        <RenameDialog path={dialog.path} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'move' ? (
        <MoveDialog path={dialog.path} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'remove' ? (
        <RemoveDialog path={dialog.path} onClose={() => setDialog(null)} />
      ) : null}
    </aside>
  );
}

interface TreeRowProps {
  readonly node: TreeNode;
  readonly depth: number;
  readonly expanded: ReadonlySet<string>;
  readonly selectedPath: string | null;
  readonly toggle: (path: string) => void;
  readonly onSelect: (path: string | null) => void;
  readonly onAction: (kind: 'new-folder' | 'rename' | 'move' | 'remove', path: string) => void;
  readonly countsOf: (path: string) => SourceCounts;
}

function TreeRow({
  node,
  depth,
  expanded,
  selectedPath,
  toggle,
  onSelect,
  onAction,
  countsOf,
}: TreeRowProps) {
  const isDirectory = node.kind === 'directory';
  const managed = node.kind === 'file' && isSupportedSource(node.path);
  const isOpen = expanded.has(node.path);
  const selected = node.path === selectedPath;
  const counts = managed ? countsOf(node.path) : { sprites: 0, animations: 0 };

  let icon: ReactNode;
  if (node.kind === 'symlink') icon = <Link width={24} height={24} />;
  else if (isDirectory) icon = <Folder width={24} height={24} />;
  else if (managed) icon = <Image width={24} height={24} />;
  else icon = <File width={24} height={24} />;

  return (
    <>
      <div
        className={`tree-row${selected ? ' is-selected' : ''}${node.status === 'missing' ? ' is-missing' : ''}`}
        style={{ paddingLeft: `${6 + depth * 16}px` }}
        role="treeitem"
        aria-selected={selected}
        aria-expanded={isDirectory ? isOpen : undefined}
      >
        {isDirectory ? (
          <button
            type="button"
            className="tree-toggle"
            aria-label={isOpen ? 'Contraer' : 'Expandir'}
            onClick={() => toggle(node.path)}
          >
            {isOpen ? (
              <ChevronDown width={24} height={24} />
            ) : (
              <ChevronRight width={24} height={24} />
            )}
          </button>
        ) : (
          <span className="tree-toggle" aria-hidden="true" />
        )}
        <span className="tree-icon" aria-hidden="true">
          {icon}
        </span>
        <button
          type="button"
          className="tree-label"
          title={node.path}
          onClick={() => {
            if (isDirectory) toggle(node.path);
            else if (managed) onSelect(node.path);
          }}
        >
          {node.name}
        </button>
        {node.status === 'defined' ? <span className="def-dot" title="Con definiciones" /> : null}
        {node.status === 'missing' ? (
          <span className="missing-badge" title="La ruta está en db.json pero el archivo no existe">
            <WarningDiamond width={20} height={20} />
          </span>
        ) : null}
        {counts.sprites > 0 ? (
          <span className="count-badge" title={`${counts.sprites} sprites`}>
            {counts.sprites} sp
          </span>
        ) : null}
        {counts.animations > 0 ? (
          <span className="count-badge badge-anim" title={`${counts.animations} animaciones`}>
            {counts.animations} an
          </span>
        ) : null}
        {isDirectory || managed ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="tree-more" aria-label={`Acciones para ${node.name}`}>
                <MoreHorizontal width={20} height={20} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="pixel-menu">
              {isDirectory ? (
                <DropdownMenuItem
                  className="pixel-font text-[10px] gap-2 cursor-pointer"
                  onSelect={() => onAction('new-folder', node.path)}
                >
                  <FolderPlus width={20} height={20} /> Nueva carpeta aquí
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="pixel-font text-[10px] gap-2 cursor-pointer"
                onSelect={() => onAction('rename', node.path)}
              >
                <Pencil width={20} height={20} /> Renombrar
              </DropdownMenuItem>
              <DropdownMenuItem
                className="pixel-font text-[10px] gap-2 cursor-pointer"
                onSelect={() => onAction('move', node.path)}
              >
                <Move width={20} height={20} /> Mover a…
              </DropdownMenuItem>
              <DropdownMenuItem
                className="pixel-font text-[10px] gap-2 cursor-pointer text-destructive focus:text-destructive"
                onSelect={() => onAction('remove', node.path)}
              >
                <Delete width={20} height={20} /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {isDirectory && isOpen
        ? node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedPath={selectedPath}
              toggle={toggle}
              onSelect={onSelect}
              onAction={onAction}
              countsOf={countsOf}
            />
          ))
        : null}
    </>
  );
}
