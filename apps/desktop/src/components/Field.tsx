import type { ReactNode } from 'react';

interface FieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-block">
      <span className="spinner" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

interface EmptyStateProps {
  readonly icon?: ReactNode;
  readonly title: string;
  readonly children?: ReactNode;
}

export function EmptyState({ icon, title, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <h3>{title}</h3>
      {children ? <div className="empty-copy">{children}</div> : null}
    </div>
  );
}
