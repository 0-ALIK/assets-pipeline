import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ChevronDown,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  FolderPlus,
  Image,
  Link2,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { isSupportedSource } from '@assets-pipeline/core';
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

interface MenuState {
  readonly node: TreeNode;
  readonly x: number;
  readonly y: number;
}

interface SourceCounts {
  readonly sprites: number;
  readonly animations: number;
}

export function ExplorerPanel({ selectedPath, onSelect }: ExplorerPanelProps) {
  const { files, database, busy, refresh } = useRepository();
  const tree = useMemo(() => buildFileTree(files), [files]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [menu, setMenu] = useState<MenuState | null>(null);
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

  return (
    <aside className="explorer-panel" aria-label="Archivos del repositorio">
      <div className="explorer-toolbar">
        <span className="explorer-title">Archivos</span>
        <div className="explorer-toolbar-actions">
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setDialog({ kind: 'new-folder', parent: '' })}
          >
            <FolderPlus size={14} /> Carpeta
          </button>
          <button
            type="button"
            className="btn btn-sm btn-icon"
            aria-label="Recargar archivos"
            disabled={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={14} />
          </button>
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
              onMenu={(target, x, y) => setMenu({ node: target, x, y })}
              countsOf={countsOf}
            />
          ))
        )}
      </div>

      <footer className="explorer-legend">
        <span className="def-dot" aria-hidden="true" />
        <span>con definiciones</span>
        <span className="legend-sep" aria-hidden="true" />
        <TriangleAlert size={12} aria-hidden="true" />
        <span>sin archivo</span>
      </footer>

      {menu ? (
        <ContextMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
          {menu.node.kind === 'directory' ? (
            <MenuItem
              icon={<FolderPlus size={14} />}
              label="Nueva carpeta aquí"
              onSelect={() => {
                setDialog({ kind: 'new-folder', parent: menu.node.path });
                setMenu(null);
              }}
            />
          ) : null}
          <MenuItem
            icon={<Pencil size={14} />}
            label="Renombrar"
            onSelect={() => {
              setDialog({ kind: 'rename', path: menu.node.path });
              setMenu(null);
            }}
          />
          <MenuItem
            icon={<MoveRight size={14} />}
            label="Mover a…"
            onSelect={() => {
              setDialog({ kind: 'move', path: menu.node.path });
              setMenu(null);
            }}
          />
          <MenuItem
            icon={<Trash2 size={14} />}
            label="Eliminar"
            danger
            onSelect={() => {
              setDialog({ kind: 'remove', path: menu.node.path });
              setMenu(null);
            }}
          />
        </ContextMenu>
      ) : null}

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
  readonly onMenu: (node: TreeNode, x: number, y: number) => void;
  readonly countsOf: (path: string) => SourceCounts;
}

function TreeRow({
  node,
  depth,
  expanded,
  selectedPath,
  toggle,
  onSelect,
  onMenu,
  countsOf,
}: TreeRowProps) {
  const isDirectory = node.kind === 'directory';
  const managed = node.kind === 'file' && isSupportedSource(node.path);
  const isOpen = expanded.has(node.path);
  const selected = node.path === selectedPath;
  const counts = managed ? countsOf(node.path) : { sprites: 0, animations: 0 };

  let icon: ReactNode;
  if (node.kind === 'symlink') icon = <Link2 size={14} />;
  else if (isDirectory) icon = isOpen ? <FolderOpen size={14} /> : <Folder size={14} />;
  else if (managed) icon = <Image size={14} />;
  else icon = <File size={14} />;

  return (
    <>
      <div
        className={`tree-row${selected ? ' is-selected' : ''}${node.status === 'missing' ? ' is-missing' : ''}`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
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
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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
            <TriangleAlert size={13} />
          </span>
        ) : null}
        {counts.sprites > 0 ? (
          <span className="count-badge" title={`${counts.sprites} sprites`}>
            {counts.sprites}
          </span>
        ) : null}
        {counts.animations > 0 ? (
          <span className="count-badge badge-anim" title={`${counts.animations} animaciones`}>
            <Play size={10} />
            {counts.animations}
          </span>
        ) : null}
        {isDirectory || managed ? (
          <button
            type="button"
            className="tree-more"
            aria-label={`Acciones para ${node.name}`}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onMenu(node, rect.left, rect.bottom + 4);
            }}
          >
            <MoreHorizontal size={14} />
          </button>
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
              onMenu={onMenu}
              countsOf={countsOf}
            />
          ))
        : null}
    </>
  );
}

interface ContextMenuProps {
  readonly x: number;
  readonly y: number;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  useEffect(() => {
    const handlePointer = (): void => onClose();
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', handlePointer);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('pointerdown', handlePointer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div
      className="context-menu"
      style={{
        left: Math.min(x, window.innerWidth - 220),
        top: Math.min(y, window.innerHeight - 200),
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

interface MenuItemProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly danger?: boolean;
  readonly onSelect: () => void;
}

function MenuItem({ icon, label, danger, onSelect }: MenuItemProps) {
  return (
    <button
      type="button"
      className={`context-menu-item${danger ? ' is-danger' : ''}`}
      onClick={onSelect}
    >
      {icon}
      {label}
    </button>
  );
}
