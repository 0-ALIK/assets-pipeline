# Validation

Persisted schema validation and migrations for `.assets-pipeline-cache/db.json` (versions 1 to 4).
The JSON repository store runs it on read and write, so an invalid state never reaches a use case
or the disk.
