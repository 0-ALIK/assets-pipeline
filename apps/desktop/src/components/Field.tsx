import type { ReactNode } from 'react';
import { Label } from './ui/pixelact-ui/label.js';
import { Spinner as PixelSpinner } from './ui/pixelact-ui/spinner.js';

interface FieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}

export function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="field">
      <Label className="field-label text-muted-foreground">{label}</Label>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-block">
      <PixelSpinner width={24} height={24} aria-hidden="true" />
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
