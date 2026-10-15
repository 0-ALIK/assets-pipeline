# Assets Pipeline

Assets Pipeline is a workspace with three projects:

- **Core** (`packages/core`): platform-independent use cases, domain rules, validation, events, persistence ports, and asset importer/builder contracts.
- **CLI** (`apps/cli`): Node.js command-line interface that consumes Core.
- **Desktop** (`apps/desktop`): React and Tauri editor shell that consumes Core.

```text
CLI ───────┐
           ├──> Core ───> ports for repository storage, importers, builders, and events
Desktop ───┘
```

## Requirements

- Node.js 22.12 or newer
- pnpm 10 or newer
- Rust and the platform-specific Tauri prerequisites to build the native desktop app

## Getting started

```sh
pnpm install
pnpm cli version
pnpm --filter @assets-pipeline/desktop tauri dev
```

The initial CLI command is `version`. The desktop start screen displays the desktop package version.

See the root and project `AGENTS.md` files for architecture and contribution conventions.
