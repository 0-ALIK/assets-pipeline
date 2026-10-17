/**
 * Domain events describe completed facts. The repository aggregate records them
 * while a transaction mutates state; the application service publishes them.
 */
export type RepositoryEventPayload =
  | { readonly type: 'repository.initialized'; readonly projectId: string }
  | { readonly type: 'sprite.added'; readonly path: string; readonly id: string }
  | { readonly type: 'sprite.updated'; readonly id: string }
  | { readonly type: 'sprite.renamed'; readonly from: string; readonly to: string }
  | { readonly type: 'sprite.duplicated'; readonly from: string; readonly to: string }
  | { readonly type: 'sprite.removed'; readonly id: string }
  | { readonly type: 'animation.added'; readonly path: string; readonly id: string }
  | { readonly type: 'animation.updated'; readonly id: string }
  | { readonly type: 'animation.renamed'; readonly from: string; readonly to: string }
  | { readonly type: 'animation.removed'; readonly id: string }
  | {
      readonly type: 'frame.added';
      readonly animation: string;
      readonly sprite: string;
      readonly durationMs: number;
      readonly at: number;
    }
  | { readonly type: 'frame.updated'; readonly animation: string; readonly at: number }
  | {
      readonly type: 'frame.moved';
      readonly animation: string;
      readonly from: number;
      readonly to: number;
    }
  | { readonly type: 'frame.removed'; readonly animation: string; readonly at: number }
  | {
      readonly type: 'atlas.added';
      readonly name: string;
      readonly size: number;
      readonly gap: number;
    }
  | { readonly type: 'atlas.updated'; readonly name: string }
  | { readonly type: 'atlas.removed'; readonly name: string }
  | { readonly type: 'atlas.group-assigned'; readonly atlas: string; readonly group: string }
  | { readonly type: 'atlas.group-unassigned'; readonly atlas: string; readonly group: string }
  | { readonly type: 'path.moved'; readonly from: string; readonly to: string }
  | { readonly type: 'path.removed'; readonly path: string }
  | { readonly type: 'directory.made'; readonly path: string };
