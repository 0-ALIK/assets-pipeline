# Entities

Entities own their invariants and are mutable only inside a repository transaction:

- `animation.ts` edits frame sequences (duration, order, references) and validates playback.
- `source.ts` keeps a file's sprites and animations consistent: frames must reference sprites of
  the same file and a source with animations cannot lose its last sprite.
- `atlas.ts` keeps page size, gap and assigned groups coherent.
- `repository.ts` is the aggregate root for `db.json`: enforces repository-wide sprite and
  animation uniqueness, atlas group exclusivity, file moves and removals, and records the domain
  events every completed fact produces.
