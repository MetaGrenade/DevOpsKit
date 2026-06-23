import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALL_NAV_ITEMS, NAV_GROUPS, type PageId } from "../navigation";
import { NavIconGlyph, SearchIcon, SunIcon, MoonIcon, MonitorIcon } from "./icons";
import { Kbd } from "./ui/primitives";
import { useTheme } from "../hooks/useTheme";
import { useToast } from "./ui/Toast";
import type { ThemeMode } from "../lib/theme";

type CommandIcon =
  | { kind: "nav"; icon: Parameters<typeof NavIconGlyph>[0]["icon"] }
  | { kind: "theme"; mode: ThemeMode }
  | { kind: "search"; type: string };

interface Command {
  id: string;
  label: string;
  description: string;
  group: string;
  keywords: string[];
  icon: CommandIcon;
  run: () => void | Promise<void>;
}

interface SearchApiResult {
  id: string;
  type: "module" | "report" | "action" | "docs";
  label: string;
  description: string;
  group: string;
  page?: string;
  available?: boolean;
  actionMethod?: "POST";
  actionPath?: string;
}

const GROUP_BY_PAGE = new Map<PageId, string>(
  NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.id, group.label] as const)),
);

function CommandGlyph({ icon }: { icon: CommandIcon }) {
  if (icon.kind === "nav") {
    return <NavIconGlyph icon={icon.icon} size="sm" />;
  }
  if (icon.kind === "theme") {
    if (icon.mode === "light") return <SunIcon size="sm" />;
    if (icon.mode === "dark") return <MoonIcon size="sm" />;
    return <MonitorIcon size="sm" />;
  }
  return <SearchIcon size="sm" />;
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
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchApiResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const runAction = useCallback(
    async (actionPath: string) => {
      const response = await fetch(actionPath, { method: "POST" });
      const payload = (await response.json()) as { message?: string; summary?: Record<string, number> };
      if (!response.ok) {
        notify({ title: "Action failed", message: payload.message ?? undefined, tone: "error" });
        return;
      }
      const summaryText = payload.summary
        ? Object.entries(payload.summary)
            .slice(0, 3)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" · ")
        : undefined;
      notify({ title: "Action complete", message: summaryText ?? payload.message, tone: "success" });
    },
    [notify],
  );

  const staticCommands = useMemo<Command[]>(() => {
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

  useEffect(() => {
    if (!open) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      fetch(`/api/v1/search${params}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { results: [] }))
        .then((data: { results: SearchApiResult[] }) => setSearchResults(data.results ?? []))
        .catch(() => {
          if (!controller.signal.aborted) {
            setSearchResults([]);
          }
        });
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const searchCommands = useMemo<Command[]>(() => {
    return searchResults.map((result) => {
      const description =
        result.type === "report" && result.available === false
          ? `${result.description} · not generated yet`
          : result.description;

      return {
        id: `search:${result.id}`,
        label: result.label,
        description,
        group: result.group,
        keywords: [result.id, result.type],
        icon: { kind: "search", type: result.type },
        run: async () => {
          if (result.type === "action" && result.actionPath) {
            await runAction(result.actionPath);
            return;
          }
          if (result.page) {
            onNavigate(result.page as PageId);
          }
        },
      };
    });
  }, [searchResults, onNavigate, runAction]);

  const commands = useMemo(() => {
    if (!query.trim()) {
      return staticCommands;
    }
    const normalized = query.trim().toLowerCase();
    const filteredStatic = staticCommands.filter((command) =>
      [command.label, command.description, command.group, ...command.keywords]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
    const staticIds = new Set(filteredStatic.map((command) => command.id));
    const extraSearch = searchCommands.filter((command) => !staticIds.has(command.id));
    return [...filteredStatic, ...extraSearch];
  }, [staticCommands, searchCommands, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ command: Command; index: number }>>();
    commands.forEach((command, index) => {
      const list = map.get(command.group) ?? [];
      list.push({ command, index });
      map.set(command.group, list);
    });
    return Array.from(map.entries());
  }, [commands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setSearchResults([]);
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, commands.length]);

  const runCommand = useCallback(
    async (command: Command | undefined) => {
      if (!command) return;
      await command.run();
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
        setActiveIndex((index) => (commands.length ? (index + 1) % commands.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (commands.length ? (index - 1 + commands.length) % commands.length : 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        void runCommand(commands[activeIndex]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, commands, activeIndex, onClose, runCommand]);

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
            placeholder="Search modules, reports, and actions…"
            aria-label="Search commands"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="cmdk-list" ref={listRef}>
          {commands.length === 0 ? (
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
                    onClick={() => void runCommand(command)}
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
