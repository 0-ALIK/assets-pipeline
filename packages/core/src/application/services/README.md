# Application services

Orchestration shared by several use cases:

- `change-repository.ts`: read, apply a domain command, refresh `updatedAt`, persist and publish
  the completed domain events.
- `path-change-planner.ts`: previews what a move or removal touches before anything happens.
- `build-assets.ts`: plans the atlas build, decodes sources through the `AssetImporter` port and
  renders the artifacts through the `AssetBuilder` port.
