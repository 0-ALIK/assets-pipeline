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
