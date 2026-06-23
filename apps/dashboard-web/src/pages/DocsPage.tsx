import { PageIntro, PageStack, Panel } from "../components/ui/page";
import { Kbd } from "../components/ui/primitives";
import { NavIconGlyph } from "../components/icons";
import { NAV_GROUPS, type PageId } from "../navigation";

interface DocsPageProps {
  onNavigate?: (page: PageId) => void;
}

const SECTIONS = [
  { id: "getting-started", label: "Getting started" },
  { id: "workflow", label: "Daily workflow" },
  { id: "modules", label: "Module reference" },
  { id: "api", label: "API reference" },
  { id: "shortcuts", label: "Keyboard shortcuts" },
  { id: "cli", label: "CLI cheatsheet" },
] as const;

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: "1 · Register a workspace",
    body: "Open Workspaces and point FDT at a FiveM server folder. A .fdt/workspace.json is created to scope every module.",
  },
  {
    title: "2 · Validate resources",
    body: "Run Resource Doctor to scan manifests, then review the Dependency Graph and Security audit before authoring content.",
  },
  {
    title: "3 · Author neutral content",
    body: "Define items, commerce, domains, and vehicles as framework-neutral JSON under .fdt/content, then export to your adapter.",
  },
  {
    title: "4 · Ship with evidence",
    body: "Attach QA and Performance snapshots, pass CI gates, then cut a release bundle with a generated deploy checklist.",
  },
];

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["⌘", "K"], label: "Open the command palette (Ctrl+K on Windows/Linux)" },
  { keys: ["↑", "↓"], label: "Move between results in the palette" },
  { keys: ["↵"], label: "Run the highlighted command" },
  { keys: ["esc"], label: "Close the palette or mobile navigation" },
];

const CLI_COMMANDS: Array<{ command: string; description: string }> = [
  { command: "pnpm fdt validate", description: "Run Resource Doctor against the active workspace" },
  { command: "pnpm fdt graph", description: "Generate the resource dependency graph report" },
  { command: "pnpm fdt content export", description: "Export neutral content to your framework adapter" },
  { command: "pnpm fdt release", description: "Build a release bundle and deploy checklist" },
];

export default function DocsPage({ onNavigate }: DocsPageProps) {
  return (
    <PageStack>
      <PageIntro
        title="Documentation & Help"
        description="Everything you need to run the FiveM DevOps Toolkit — from first launch to shipping a release."
      />

      <div className="docs-layout">
        <nav className="docs-toc" aria-label="On this page">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="docs-toc-link">
              {section.label}
            </a>
          ))}
        </nav>

        <div>
          <section id="getting-started" className="docs-section">
            <Panel className="panel-compact">
              <h2 className="panel-heading">Getting started</h2>
              <p className="panel-subtext">
                FDT is framework-agnostic: author content once, then export to ox, QBCore, or your
                own adapter. Follow these four steps on your first run.
              </p>
              <div className="panel-section" style={{ display: "grid", gap: "0.75rem" }}>
                {STEPS.map((step) => (
                  <div key={step.title} className="finding-card">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{step.body}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section id="workflow" className="docs-section">
            <Panel className="panel-compact">
              <h2 className="panel-heading">Daily workflow</h2>
              <p className="panel-subtext">
                The sidebar is ordered to match how the suite is used: Start → Validate → World →
                Content → Ship → Deploy. Press <Kbd>⌘</Kbd> <Kbd>K</Kbd> anywhere to jump between
                modules.
              </p>
            </Panel>
          </section>

          <section id="modules" className="docs-section">
            <Panel className="panel-compact">
              <h2 className="panel-heading">Module reference</h2>
              <p className="panel-subtext">Every module grouped by workflow stage. Click to open.</p>
              <div className="panel-section" style={{ display: "grid", gap: "1rem" }}>
                {NAV_GROUPS.map((group) => (
                  <div key={group.id}>
                    <p className="nav-group-label">{group.label}</p>
                    {group.summary && (
                      <p className="mb-2 text-xs text-[var(--color-muted)]">{group.summary}</p>
                    )}
                    <div
                      style={{
                        display: "grid",
                        gap: "0.5rem",
                        gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
                      }}
                    >
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="finding-card"
                          style={{ textAlign: "left", cursor: onNavigate ? "pointer" : "default" }}
                          onClick={() => onNavigate?.(item.id)}
                        >
                          <span
                            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                            className="text-sm font-semibold"
                          >
                            <NavIconGlyph icon={item.icon} size="sm" />
                            {item.label}
                          </span>
                          <span className="mt-1 block text-xs text-[var(--color-muted)]">
                            {item.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section id="api" className="docs-section">
            <Panel className="panel-compact">
              <h2 className="panel-heading">API reference</h2>
              <p className="panel-subtext">
                The dashboard web UI talks to <code className="inline-code">dashboard-api</code> over REST.
                Browse the OpenAPI spec and Swagger UI for every endpoint, request shape, and response.
              </p>
              <div className="panel-section">
                <button
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={() => onNavigate?.("api-docs")}
                  disabled={!onNavigate}
                >
                  Open API Reference
                </button>
                {!onNavigate && (
                  <p className="mt-2 text-xs text-[var(--color-muted)]">
                    Select <strong>API Reference</strong> from the Start group in the sidebar.
                  </p>
                )}
              </div>
            </Panel>
          </section>

          <section id="shortcuts" className="docs-section">
            <Panel className="panel-compact">
              <h2 className="panel-heading">Keyboard shortcuts</h2>
              <div className="panel-section">
                {SHORTCUTS.map((shortcut) => (
                  <div key={shortcut.label} className="shortcut-row">
                    <span className="text-sm">{shortcut.label}</span>
                    <span className="shortcut-keys">
                      {shortcut.keys.map((key, index) => (
                        <Kbd key={index}>{key}</Kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section id="cli" className="docs-section">
            <Panel className="panel-compact">
              <h2 className="panel-heading">CLI cheatsheet</h2>
              <p className="panel-subtext">
                The dashboard and CLI share the same workspace. Reports written by the CLI appear in
                their matching module automatically.
              </p>
              <div className="panel-section" style={{ display: "grid", gap: "0.5rem" }}>
                {CLI_COMMANDS.map((entry) => (
                  <div key={entry.command} className="finding-card">
                    <code className="inline-code">{entry.command}</code>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{entry.description}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        </div>
      </div>
    </PageStack>
  );
}
