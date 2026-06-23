import type { ReactNode } from "react";

export type EmptyStateVariant = "workspace" | "data" | "report" | "content";

export function EmptyStateIllustration({ variant }: { variant: EmptyStateVariant }) {
  if (variant === "workspace") {
    return (
      <svg className="empty-illustration" viewBox="0 0 160 120" aria-hidden="true">
        <rect x="24" y="28" width="88" height="64" rx="8" className="empty-illustration-surface" />
        <path d="M24 44h88" className="empty-illustration-line" />
        <circle cx="36" cy="36" r="4" className="empty-illustration-accent" />
        <circle cx="48" cy="36" r="4" className="empty-illustration-muted" />
        <circle cx="60" cy="36" r="4" className="empty-illustration-muted" />
        <rect x="36" y="56" width="48" height="6" rx="3" className="empty-illustration-muted" />
        <rect x="36" y="68" width="64" height="6" rx="3" className="empty-illustration-line" />
        <path
          d="M112 72l20 20H112V72z"
          className="empty-illustration-accent"
          opacity="0.85"
        />
        <rect x="104" y="64" width="28" height="36" rx="6" className="empty-illustration-surface" />
      </svg>
    );
  }

  if (variant === "report") {
    return (
      <svg className="empty-illustration" viewBox="0 0 160 120" aria-hidden="true">
        <rect x="40" y="16" width="80" height="88" rx="8" className="empty-illustration-surface" />
        <rect x="52" y="32" width="40" height="6" rx="3" className="empty-illustration-line" />
        <rect x="52" y="44" width="56" height="4" rx="2" className="empty-illustration-muted" />
        <rect x="52" y="52" width="48" height="4" rx="2" className="empty-illustration-muted" />
        <rect x="52" y="68" width="12" height="24" rx="3" className="empty-illustration-accent" />
        <rect x="68" y="76" width="12" height="16" rx="3" className="empty-illustration-line" />
        <rect x="84" y="60" width="12" height="32" rx="3" className="empty-illustration-accent" opacity="0.7" />
        <circle cx="120" cy="88" r="18" className="empty-illustration-ring" />
        <path d="M114 88l4 4 8-8" className="empty-illustration-accent" strokeWidth="3" fill="none" stroke="currentColor" />
      </svg>
    );
  }

  if (variant === "content") {
    return (
      <svg className="empty-illustration" viewBox="0 0 160 120" aria-hidden="true">
        <rect x="48" y="36" width="64" height="48" rx="8" className="empty-illustration-surface" />
        <path d="M48 52h64" className="empty-illustration-line" />
        <rect x="58" y="62" width="20" height="16" rx="4" className="empty-illustration-accent" opacity="0.85" />
        <rect x="82" y="62" width="20" height="16" rx="4" className="empty-illustration-line" />
        <rect x="58" y="82" width="44" height="6" rx="3" className="empty-illustration-muted" />
        <circle cx="80" cy="24" r="12" className="empty-illustration-ring" />
        <path d="M74 24h12M80 18v12" className="empty-illustration-accent" strokeWidth="2.5" stroke="currentColor" />
      </svg>
    );
  }

  return (
    <svg className="empty-illustration" viewBox="0 0 160 120" aria-hidden="true">
      <rect x="32" y="24" width="96" height="72" rx="10" className="empty-illustration-surface" />
      <rect x="44" y="40" width="72" height="8" rx="4" className="empty-illustration-line" />
      <rect x="44" y="54" width="56" height="6" rx="3" className="empty-illustration-muted" />
      <rect x="44" y="66" width="64" height="6" rx="3" className="empty-illustration-muted" />
      <rect x="44" y="78" width="40" height="6" rx="3" className="empty-illustration-muted" />
      <circle cx="116" cy="84" r="16" className="empty-illustration-ring" />
      <path
        d="M108 84h16M116 76v16"
        className="empty-illustration-accent"
        strokeWidth="2.5"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ZeroDataPanel({
  title,
  description,
  variant = "data",
  action,
}: {
  title: string;
  description?: ReactNode;
  variant?: EmptyStateVariant;
  action?: ReactNode;
}) {
  return (
    <div className="zero-data-panel">
      <EmptyStateIllustration variant={variant} />
      <div className="zero-data-copy">
        <p className="zero-data-title">{title}</p>
        {description && <p className="zero-data-desc">{description}</p>}
        {action && <div className="zero-data-action">{action}</div>}
      </div>
    </div>
  );
}
