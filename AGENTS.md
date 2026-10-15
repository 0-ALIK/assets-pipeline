# Repository conventions

## Project map

- `packages/core` owns the platform-independent domain, use cases, validation, events, persistence contracts, and importer/builder contracts.
- `apps/cli` is the Node.js command-line application. It adapts Node facilities to Core and presents command output.
- `apps/desktop` is the React and Tauri desktop application. React owns presentation; Tauri adapters provide native capabilities.
- Dependencies flow from the CLI and Desktop App into Core. Core must never import from either application.

## General rules

- Read the nearest `AGENTS.md` before changing a project. A project's file supplements this root file.
- Keep TypeScript strict. Prefer explicit public types and small modules organized by capability.
- Keep business rules in Core use cases/domain code, not in UI components, CLI commands, or platform adapters.
- Define platform needs as Core ports. Put implementations that depend on Node, Tauri, or browser APIs in the consuming application.
- Keep the Core public surface explicit through `packages/core/src/index.ts`; do not make consumers import internal paths.
- Use asynchronous APIs for filesystem and long-running operations. Propagate typed/domain errors and avoid swallowing failures.
- Persisted data must be schema-versioned and validated when read. Add migrations when changing the persisted format.
- Domain events describe completed facts and are emitted by application workflows; adapters decide how to present or transport them.
- Do not add product behavior without requirements. Empty capabilities should be represented by contracts and clear extension points.
- Keep package versions aligned at the workspace level when publishing or releasing the three projects.

## Commands

- Use `pnpm` for workspace operations.
- Root scripts are the canonical entry points for build, lint, formatting, and type checking.
- Keep each project's scripts usable from its own directory as well as through workspace filters.
