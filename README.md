# Assets Pipeline

**Documentación completa de la CLI:** [manual y referencia de comandos](docs/README.md).

Assets Pipeline is a workspace with three projects:

- **Core** (`packages/core`): platform-independent use cases, domain rules, validation, events, persistence ports, and asset importer/builder contracts.
- **CLI** (`apps/cli`): Node.js command-line interface that consumes Core.
- **Desktop** (`apps/desktop`): React and Tauri editor shell that consumes Core.

```text
CLI ───────┐
           ├──> Core ───> ports for repository storage, importers, builders, and events
Desktop ───┘
```

## Current scope

Core and CLI manage a local repository of PNG and Aseprite sources, sprite regions, animation
sequences, atlas assignments, and deterministic PNG builds. The Desktop application remains a
startup shell. Watch mode is not implemented yet.

The repository metadata lives in `.assets-pipeline-cache/db.json`. This file is the source of truth
for user definitions, so keep it under backup or version control along with the source assets. The
schema is versioned; the original scaffold schema is migrated in memory and its old records are
preserved under `legacy` on the next write. The cache directory is reserved and cannot be managed
with `fs` commands.

## Requirements

- Node.js 22.12 or newer
- pnpm 11 or newer
- Rust and the platform-specific Tauri prerequisites to build the native desktop app

## Getting started

```sh
pnpm install
pnpm cli version
pnpm cli init "My RPG Assets" --path ./game-assets
pnpm cli --repo ./game-assets info
pnpm --filter @assets-pipeline/desktop tauri dev
```

`init` requires an existing directory and refuses nested repositories. In an existing repository,
the CLI discovers the root by searching from the current directory upward. Use `--repo <directory>`
before a command to select another root. All paths in commands and in `db.json` are relative to that
root and use `/` separators.
Use the exact filename capitalization shown by the filesystem.

```sh
pnpm cli ls
pnpm cli ls --untracked
pnpm cli status
pnpm cli fs mkdir entities/humans
pnpm cli sprite add entities/humans_parts.aseprite --id npc/head/front/idle_0 --rect 64,0,32,32 --pivot 0.5,1
pnpm cli animation add entities/humans_parts.aseprite --id npc/head/front/idle --playback loop
pnpm cli animation frame add npc/head/front/idle --sprite npc/head/front/idle_0 --duration 120
pnpm cli group list
pnpm cli atlas add characters --size 2048 --gap 2
pnpm cli atlas group add characters npc
pnpm cli validate
pnpm cli build --output dist/assets
```

Sprite and animation IDs are unique within their respective types across the repository. A file is
`defined` when it has at least one sprite. `ls` highlights defined files in blue in an interactive
terminal; `ls --untracked` lists compatible files without sprites. Frames use zero-based indexes and
durations in milliseconds. For `animation frame move`, `--to` may equal the current frame count to
move a frame to the end. Empty animations are allowed while editing but rejected by atlas
validation and builds. Each frame must reference a sprite in the animation's source file. Renaming
a sprite updates its frame references. Removing an in-use sprite fails until its references are
removed.

`fs move`, `fs rename`, and `fs rm` preview affected files and definitions and ask for confirmation.
Moves create missing destination parent folders; the preview lists those folders.
Use `--dry-run` for a preview, or `--yes` to confirm in non-interactive scripts. `--yes` never skips
integrity checks. Deleting a nonempty folder also requires `--recursive`. Removing sprites,
animations, or frames asks for confirmation and supports `--yes`.

`validate` checks the persisted schema, source headers, and whether sprite rectangles fit within
the source canvas. When atlas configuration exists, it also checks group coverage and capacity.
It does not decode all pixels or verify PNG CRCs or every Aseprite chunk. `build` keeps every
animation on one atlas page and generates PNG pages, one sprite/animation JSON beside each PNG,
and the required global `index.json`. The desktop start screen displays its package version.

See the root and project `AGENTS.md` files for architecture and contribution conventions.
