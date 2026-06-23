import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="tooltip">
      {children}
      <span role="tooltip" className="tooltip-bubble">
        {label}
      </span>
    </span>
  );
}

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <span
          key={index}
          className="skeleton skeleton-line"
          style={{ display: "block", width: index === lines - 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={value === option.value}
          className={`segmented-btn ${value === option.value ? "segmented-btn-active" : ""}`.trim()}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
