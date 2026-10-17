# Domain events

`repository-events.ts` defines the payloads of the facts the aggregate records while a
transaction runs (sprites, animations, frames, atlases, paths). The application service publishes
them through the optional `EventPublisher` port; hosts decide how to present or transport them.
