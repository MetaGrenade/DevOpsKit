import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_NAV_ITEMS, NAV_GROUPS, type PageId } from "../navigation";
import { NavIconGlyph, SearchIcon, SunIcon, MoonIcon, MonitorIcon } from "./icons";
import { Kbd } from "./ui/primitives";
import { useTheme } from "../hooks/useTheme";
import type { ThemeMode } from "../lib/theme";

type CommandIcon =
  | { kind: "nav"; icon: Parameters<typeof NavIconGlyph>[0]["icon"] }
  | { kind: "theme"; mode: ThemeMode };

interface Command {
  id: string;
  label: string;
  description: string;
  group: string;
  keywords: string[];
  icon: CommandIcon;
  run: () => void;
}

const GROUP_BY_PAGE = new Map<PageId, string>(
  NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.id, group.label] as const)),
);

function CommandGlyph({ icon }: { icon: CommandIcon }) {
  if (icon.kind === "nav") {
    return <NavIconGlyph icon={icon.icon} size="sm" />;
  }
  if (icon.mode === "light") return <SunIcon size="sm" />;
  if (icon.mode === "dark") return <MoonIcon size="sm" />;
  return <MonitorIcon size="sm" />;
}

export default function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
}) {
  const { setMode } = useTheme();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const navCommands: Command[] = ALL_NAV_ITEMS.map((item) => ({
      id: `nav:${item.id}`,
      label: item.label,
      description: item.description,
      group: GROUP_BY_PAGE.get(item.id) ?? "Navigate",
      keywords: [item.id, ...(item.keywords ?? [])],
      icon: { kind: "nav", icon: item.icon },
      run: () => onNavigate(item.id),
    }));

    const themeCommands: Command[] = (["light", "dark", "system"] as ThemeMode[]).map((mode) => ({
      id: `theme:${mode}`,
      label: `Switch to ${mode} theme`,
      description: "Change the dashboard appearance",
      group: "Theme",
      keywords: ["theme", "appearance", "color", mode],
      icon: { kind: "theme", mode },
      run: () => setMode(mode),
    }));

    return [...navCommands, ...themeCommands];
  }, [onNavigate, setMode]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return commands;
    }
    return commands.filter((command) =>
      [command.label, command.description, command.group, ...command.keywords]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ command: Command; index: number }>>();
    filtered.forEach((command, index) => {
      const list = map.get(command.group) ?? [];
      list.push({ command, index });
      map.set(command.group, list);
    });
    return Array.from(map.entries());
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runCommand = useCallback(
    (command: Command | undefined) => {
      if (!command) return;
      command.run();
      onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (filtered.length ? (index + 1) % filtered.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (filtered.length ? (index - 1 + filtered.length) % filtered.length : 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        runCommand(filtered[activeIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filtered, activeIndex, onClose, runCommand]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="cmdk-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="cmdk-panel">
        <div className="cmdk-search">
          <span className="cmdk-search-icon">
            <SearchIcon size="sm" />
          </span>
          <input
            ref={inputRef}
            className="cmdk-input"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search modules and actions…"
            aria-label="Search commands"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="cmdk-list" ref={listRef}>
          {filtered.length === 0 ? (
            <p className="cmdk-empty">No results for “{query}”.</p>
          ) : (
            grouped.map(([groupLabel, entries]) => (
              <div key={groupLabel}>
                <p className="cmdk-group-label">{groupLabel}</p>
                {entries.map(({ command, index }) => (
                  <button
                    key={command.id}
                    type="button"
                    data-index={index}
                    className={`cmdk-item ${index === activeIndex ? "cmdk-item-active" : ""}`.trim()}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => runCommand(command)}
                  >
                    <span className="cmdk-item-icon">
                      <CommandGlyph icon={command.icon} />
                    </span>
                    <span className="cmdk-item-copy">
                      <span className="cmdk-item-label">{command.label}</span>
                      <span className="cmdk-item-desc">{command.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="cmdk-footer">
          <span className="cmdk-hint">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            to navigate
          </span>
          <span className="cmdk-hint">
            <Kbd>↵</Kbd>
            to select
          </span>
          <span className="cmdk-hint">
            <Kbd>esc</Kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
