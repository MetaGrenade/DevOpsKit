import type { ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export default function Panel({ children, className = "", glow = false }: PanelProps) {
  return (
    <section className={`panel ${glow ? "panel-glow" : ""} ${className}`.trim()}>{children}</section>
  );
}

interface PageIntroProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageIntro({ eyebrow, title, description, actions }: PageIntroProps) {
  return (
    <header className="page-intro">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
