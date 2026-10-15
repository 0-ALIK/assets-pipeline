# CLI conventions

- Keep command parsing, prompts, console output, and exit codes in the CLI layer.
- Put business workflows in Core use cases and depend on Core's public entry point only.
- Put Node-specific filesystem, path, and process behavior in `src/adapters/`.
- Commands should validate arguments early, call one application workflow, and map known errors to actionable messages and stable exit codes.
- Keep output suitable for both people and future machine-readable modes; do not add a mode until requested.
- Add commands only when requirements define their behavior. `version` is the initial command.
