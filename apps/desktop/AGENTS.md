# Desktop App conventions

- Keep React components focused on rendering and interaction. Put workflows behind feature hooks/services and call Core through its public API.
- Keep Tauri commands and plugin APIs behind `src/adapters/tauri/`; do not call native APIs directly from feature components.
- Keep browser-only code separate from Tauri-only code so the frontend remains easy to develop and inspect in a browser.
- Organize screens and state by feature (`canvas`, `explorer`, `preview`, `project`) rather than by generic component type once a feature grows.
- Shared visual primitives belong in `src/components/`; feature-specific UI stays with its feature.
- Do not place asset processing rules in components. Delegate them to Core and report progress through application events.
- Keep long-running work cancellable and expose progress/errors in the UI when the associated requirement exists.
- Read the app version from package metadata at build time; do not duplicate a version string in UI code.
- Request only the Tauri capabilities required by the feature being implemented.
