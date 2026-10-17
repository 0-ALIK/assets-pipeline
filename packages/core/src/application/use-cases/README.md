# Use cases

One module per workflow with the shape `(context: UseCaseContext, input) => output`. A use case
validates its input boundary, orchestrates the ports it needs and delegates every decision to the
repository aggregate. Add the use case here first and wire it into the `RepositoryWorkspace`
facade only when a consumer needs it.
