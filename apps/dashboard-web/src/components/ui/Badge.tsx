import type { ReactNode } from "react";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "accent";

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "badge badge-success",
  warning: "badge badge-warning",
  danger: "badge badge-danger",
  neutral: "badge badge-neutral",
  accent: "badge badge-accent",
};

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export default function Badge({ tone = "neutral", children, className = "" }: BadgeProps) {
  return <span className={`${TONE_CLASSES[tone]} ${className}`.trim()}>{children}</span>;
}
