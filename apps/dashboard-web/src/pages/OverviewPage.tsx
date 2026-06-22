import type { PageId } from "../navigation";
import Badge from "../components/ui/Badge";
import Panel, { PageIntro } from "../components/ui/Panel";

interface OverviewModule {
  id: string;
  status: string;
}

interface OverviewResponse {
  name: string;
  phase: string;
  modules: OverviewModule[];
}

interface OverviewPageProps {
  overview: OverviewResponse | null;
  apiStatus: "loading" | "online" | "offline";
  workspaceName?: string;
  onNavigate: (page: PageId) => void;
}

const QUICK_LINKS: Array<{ page: PageId; label: string; hint: string }> = [
  { page: "workspaces", label: "Workspaces", hint: "Register a server folder" },
  { page: "resources", label: "Resources", hint: "Run Resource Doctor" },
  { page: "releases", label: "Releases", hint: "Ship validated bundles" },
  { page: "environment", label: "Environment", hint: "Generate server.cfg" },
];

function phaseLabel(phase: string): string {
  return phase.replace(/-/g, " ");
}

export default function OverviewPage({
  overview,
  apiStatus,
  workspaceName,
  onNavigate,
}: OverviewPageProps) {
  const modules = overview?.modules ?? [];
  const activeCount = modules.filter((module) => module.status === "active").length;

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="hero-kicker">Operations command center</p>
          <h2 className="hero-title">
            Build, validate, and ship
            <span className="hero-accent"> FiveM servers</span>
          </h2>
          <p className="hero-description">
            Framework-agnostic workflows for validation, content authoring, QA, performance tracking,
            and release automation — all scoped to external workspaces on your machine.
          </p>
          <div className="hero-stats">
            <div className="stat-card">
              <p className="stat-value">{activeCount}</p>
              <p className="stat-label">Active modules</p>
            </div>
            <div className="stat-card">
              <p className="stat-value">{modules.length}</p>
              <p className="stat-label">Total capabilities</p>
            </div>
            <div className="stat-card">
              <p className="stat-value capitalize">{phaseLabel(overview?.phase ?? "loading")}</p>
              <p className="stat-label">Current phase</p>
            </div>
          </div>
        </div>
        <div className="hero-side">
          <Panel glow className="hero-side-card">
            <p className="panel-label">System status</p>
            <div className="hero-status-row">
              <Badge tone={apiStatus === "online" ? "success" : apiStatus === "loading" ? "warning" : "danger"}>
                API {apiStatus}
              </Badge>
              {workspaceName ? (
                <Badge tone="accent">{workspaceName}</Badge>
              ) : (
                <Badge tone="neutral">No workspace selected</Badge>
              )}
            </div>
            <p className="hero-side-copy">
              Reports and exports live beside your server in{" "}
              <code className="inline-code">.fdt/</code> — never mixed into this repository.
            </p>
            <button type="button" className="btn btn-primary w-full" onClick={() => onNavigate("workspaces")}>
              Manage workspaces
            </button>
          </Panel>
        </div>
      </section>

      <section>
        <PageIntro
          eyebrow="Quick start"
          title="Jump to a module"
          description="Use the sidebar for the full catalog — these are the most common starting points."
        />
        <div className="quick-grid">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.page}
              type="button"
              className="quick-card"
              onClick={() => onNavigate(link.page)}
            >
              <span className="quick-card-label">{link.label}</span>
              <span className="quick-card-hint">{link.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <PageIntro
          eyebrow="Platform modules"
          title="Everything in one toolkit"
          description={`${overview?.name ?? "FiveM DevOps Toolkit"} ships modular capabilities you can run from CLI, dashboard, or CI.`}
        />
        <div className="module-grid">
          {modules.map((module) => (
            <article key={module.id} className="module-card">
              <div className="module-card-head">
                <h3 className="module-card-title">{module.id.replace(/-/g, " ")}</h3>
                <Badge tone={module.status === "active" ? "success" : "neutral"}>{module.status}</Badge>
              </div>
              <div className="module-card-bar" aria-hidden="true">
                <span className={module.status === "active" ? "module-card-bar-fill" : ""} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <Panel className="panel-dashed">
        <p className="panel-label">Example external workspace</p>
        <code className="code-block">E:/FiveMServers/fdt</code>
      </Panel>
    </div>
  );
}
