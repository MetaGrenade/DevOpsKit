import type { ReactNode } from "react";
import type { NavIcon } from "../navigation";

interface IconProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS: Record<NonNullable<IconProps["size"]>, string> = {
  sm: "ui-icon-sm",
  md: "ui-icon-md",
  lg: "ui-icon-lg",
};

function Svg({ className = "", size = "md", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`ui-icon ${SIZE_CLASS[size]} ${className}`.trim()}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<NavIcon, (props: IconProps) => ReactNode> = {
  overview: (p) => (
    <Svg {...p}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </Svg>
  ),
  workspace: (p) => (
    <Svg {...p}>
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="M9 5V3M15 5V3M4 10h16" />
    </Svg>
  ),
  resource: (p) => (
    <Svg {...p}>
      <path d="M4 7h16v12H4z" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  ),
  item: (p) => (
    <Svg {...p}>
      <path d="M7 7h10v10H7z" />
      <path d="M9 3h6v4H9z" />
    </Svg>
  ),
  commerce: (p) => (
    <Svg {...p}>
      <path d="M6 7h15l-1.5 9H7.5L6 7z" />
      <path d="M6 7 5 4H2" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="18" cy="19" r="1.5" />
    </Svg>
  ),
  economy: (p) => (
    <Svg {...p}>
      <path d="M12 3v18" />
      <path d="M7 8c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5" />
    </Svg>
  ),
  statebag: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Svg>
  ),
  asset: (p) => (
    <Svg {...p}>
      <path d="M4 16l4-4 4 4 4-6 4 6" />
      <path d="M4 20h16" />
    </Svg>
  ),
  zone: (p) => (
    <Svg {...p}>
      <path d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </Svg>
  ),
  world: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </Svg>
  ),
  environment: (p) => (
    <Svg {...p}>
      <path d="M4 6h16v12H4z" />
      <path d="M8 10h8M8 14h5" />
    </Svg>
  ),
  release: (p) => (
    <Svg {...p}>
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M4 21h16" />
    </Svg>
  ),
  security: (p) => (
    <Svg {...p}>
      <path d="M12 3 4 7v6c0 5 3.5 8 8 8s8-3 8-8V7z" />
    </Svg>
  ),
  qa: (p) => (
    <Svg {...p}>
      <path d="M9 11l2 2 4-4" />
      <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z" />
    </Svg>
  ),
  ci: (p) => (
    <Svg {...p}>
      <path d="M12 3v4M12 17v4" />
      <path d="M7 7l3 3M14 14l3 3M17 7l-3 3M10 14l-3 3" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  domain: (p) => (
    <Svg {...p}>
      <path d="M4 20V8l8-4 8 4v12" />
      <path d="M4 12h16M12 4v16" />
    </Svg>
  ),
  performance: (p) => (
    <Svg {...p}>
      <path d="M4 19V5M20 19H4" />
      <path d="M8 15l3-3 3 2 4-6" />
    </Svg>
  ),
  clothing: (p) => (
    <Svg {...p}>
      <path d="M12 3 7 7h3v4h4V7h3z" />
      <path d="M6 21h12l-2-10H8z" />
    </Svg>
  ),
  vehicle: (p) => (
    <Svg {...p}>
      <path d="M5 17h14l-1-5H6z" />
      <path d="M7 12V9h10v3" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="16.5" cy="17" r="1.5" />
    </Svg>
  ),
  map: (p) => (
    <Svg {...p}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </Svg>
  ),
  graph: (p) => (
    <Svg {...p}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M8 7l4 9M16 7l-4 9" />
    </Svg>
  ),
  nui: (p) => (
    <Svg {...p}>
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8M8 13h5" />
    </Svg>
  ),
  docs: (p) => (
    <Svg {...p}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </Svg>
  ),
};

export function BellIcon(props: IconProps) {
  return (
    <Svg {...props} size={props.size ?? "sm"}>
      <path d="M12 3a5 5 0 0 0-5 5v2.5L5 13v1h14v-1l-2-2.5V8a5 5 0 0 0-5-5z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </Svg>
  );
}

export function NavIconGlyph({ icon, className = "", size = "sm" }: { icon: NavIcon; className?: string; size?: IconProps["size"] }) {
  const Component = ICONS[icon];
  return <Component className={className} size={size} />;
}

export function MenuIcon(props: IconProps) {
  return (
    <Svg {...props} size={props.size ?? "md"}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props} size={props.size ?? "md"}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function ChevronIcon({ className = "", expanded = false, size = "sm" }: IconProps & { expanded?: boolean }) {
  return (
    <Svg className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""} ${className}`.trim()} size={size}>
      <path d="M8 10l4 4 4-4" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props} size={props.size ?? "sm"}>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </Svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props} size={props.size ?? "sm"}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props} size={props.size ?? "sm"}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5z" />
    </Svg>
  );
}

export function MonitorIcon(props: IconProps) {
  return (
    <Svg {...props} size={props.size ?? "sm"}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </Svg>
  );
}
