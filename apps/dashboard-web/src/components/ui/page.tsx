import type { ReactNode } from "react";
import Panel, { PageIntro } from "./Panel";
import { EmptyStateIllustration, type EmptyStateVariant } from "./EmptyStateIllustration";

export type { EmptyStateVariant };
export { EmptyStateIllustration, ZeroDataPanel } from "./EmptyStateIllustration";

export function PageStack({ children, compact = true }: { children: ReactNode; compact?: boolean }) {
  return <div className={`page-stack ${compact ? "page-stack-compact" : ""}`}>{children}</div>;
}

export function PageAlert({
  variant = "info",
  children,
}: {
  variant?: "info" | "error" | "warning";
  children: ReactNode;
}) {
  const variantClass =
    variant === "error" ? "alert-error" : variant === "warning" ? "alert-warning" : "alert-info";
  return <div className={`alert ${variantClass}`}>{children}</div>;
}

export function StatGrid({ children, columns }: { children: ReactNode; columns?: 2 | 3 | 4 }) {
  const colClass =
    columns === 2 ? "stat-grid-2" : columns === 3 ? "stat-grid-3" : columns === 4 ? "stat-grid-4" : "";
  return <div className={`stat-grid ${colClass}`.trim()}>{children}</div>;
}

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "success" | "danger" | "warning" | "muted";
}) {
  const toneClass = tone ? `stat-tile-value-${tone}` : "";
  return (
    <article className="stat-tile">
      <p className="stat-tile-label">{label}</p>
      <p className={`stat-tile-value ${toneClass}`.trim()}>{value}</p>
      {hint && <p className="stat-tile-hint">{hint}</p>}
    </article>
  );
}

export function NotePanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <aside className="note-panel">
      {title && <p className="note-panel-title">{title}</p>}
      <div className="note-panel-body">{children}</div>
    </aside>
  );
}

export function EmptyState({
  title,
  description,
  variant = "workspace",
  action,
}: {
  title: string;
  description?: ReactNode;
  variant?: EmptyStateVariant;
  action?: ReactNode;
}) {
  return (
    <Panel className="panel-dashed panel-compact empty-state">
      <EmptyStateIllustration variant={variant} />
      <h2 className="panel-heading">{title}</h2>
      {description && <p className="panel-subtext">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </Panel>
  );
}

export { Panel, PageIntro };
