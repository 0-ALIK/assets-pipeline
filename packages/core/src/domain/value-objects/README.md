# Value objects

Immutable domain values with validation: identifiers, source paths, rectangles, pivots, frame
durations and atlas constraints. They never touch ports or I/O. `../rules.ts` re-exports them as
the stable entry point and the public API keeps the `assert*` helpers.
