# Core conventions

- Core is the source of truth for domain concepts, use cases, validation, and application events.
- Keep Core independent from React, Tauri, Node.js built-ins, and concrete storage libraries.
- Put interfaces required from the environment in `ports/`; implementations belong to CLI or Desktop adapters.
- Use cases orchestrate domain operations through injected ports. They must not access globals or perform direct I/O.
- Keep domain entities and value objects immutable where practical. Validate invariants at construction or input boundaries.
- Version persisted repository data. Validate `db.json` and project configuration before exposing them to use cases; migrations must be explicit and deterministic.
- Importers parse source formats into domain/application input models. Builders transform validated inputs into output models. Keep format-specific details inside their own modules.
- Publish only supported types and use cases from `src/index.ts`. Internal modules are not consumer APIs.
- Every public operation should document expected errors and cancellation/long-running behavior where relevant.

## Structure

- `domain/repository.ts` models the persisted shape; `domain/value-objects/` validates and combines primitive values; `domain/entities/` holds the mutable-in-transaction entities and the `Repository` aggregate root, which enforces repository-wide invariants and records domain events. The domain never touches ports or I/O.
- `application/use-cases/` holds one module per workflow with the shape `(context, input) => output`: validate the input boundary, orchestrate ports, delegate decisions to the aggregate.
- `application/services/` holds orchestration shared by use cases: `changeRepository` (read, mutate, touch, persist, publish), the path-change planner and the build workflow.
- `application/dto/` holds the shapes that cross the application boundary.
- `application/repository-workspace.ts` is a convenience facade over the use cases for the CLI and the desktop app; keep it free of logic.
- `validation/` validates and migrates the persisted schema; the JSON store runs it on read and write.
- The build workflow lives in Core (`buildAssets`): it plans pages, decodes sources through the `AssetImporter` port and renders artifacts through the `AssetBuilder` port. Publishing the artifacts is the host's job. Completed facts are published through the optional `EventPublisher`.
