import type { PageId } from "../navigation";
import { NAV_GROUPS } from "../navigation";
import Badge from "../components/ui/Badge";
import OnboardingChecklist from "../components/OnboardingChecklist";
import Panel, { PageIntro } from "../components/ui/Panel";
import { PageStack } from "../components/ui/page";

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

const GETTING_STARTED = [
  {
    step: 1,
    title: "Register your server folder",
    body: "Point FDT at an external FiveM server directory — not this monorepo. All reports and content land in .fdt/ beside your resources.",
    page: "workspaces" as PageId,
    cta: "Open Workspaces",
    cli: "fdt workspace init --path E:/FiveMServers/my-server",
  },
  {
    step: 2,
    title: "Validate the resource tree",
    body: "Run Resource Doctor to scan fxmanifest files, catch broken dependencies, and review findings before players connect.",
    page: "resources" as PageId,
    cta: "Open Resources",
    cli: "fdt validate resources",
  },
  {
    step: 3,
    title: "Author content and world data",
    body: "Use the dashboard or CLI to build neutral JSON — items, zones, shops, maps — then export through QBCore, ESX, ox, or custom adapters.",
    page: "items" as PageId,
    cta: "Open Items",
    cli: "fdt content validate && fdt content export --adapter custom-json",
  },
  {
    step: 4,
    title: "Test, bundle, and deploy",
    body: "Attach QA runs and performance snapshots, pass CI gates, cut a release bundle, then generate server.cfg profiles for each environment.",
    page: "releases" as PageId,
    cta: "Open Releases",
    cli: "fdt release create --version 1.0.0 && fdt environment generate",
  },
];

interface WorkflowPersona {
  id: string;
  title: string;
  subtitle: string;
  steps: Array<{ label: string; page: PageId }>;
  example: string;
}

const WORKFLOW_PERSONAS: WorkflowPersona[] = [
  {
    id: "devops",
    title: "Server owner / DevOps",
    subtitle: "Keep production healthy, reproducible, and ready to redeploy.",
    steps: [
      { label: "Register and switch workspaces", page: "workspaces" },
      { label: "Scan resources and fix manifests", page: "resources" },
      { label: "Review security baseline", page: "security" },
      { label: "Wire CI validation gates", page: "ci" },
      { label: "Cut release bundles with checklists", page: "releases" },
      { label: "Generate server.cfg per environment", page: "environment" },
    ],
    example:
      "pnpm dev → select workspace → fdt validate resources → fdt security audit → fdt ci run → fdt release create",
  },
  {
    id: "content",
    title: "Content & economy author",
    subtitle: "Build items, shops, and domain records without locking into one framework.",
    steps: [
      { label: "Define items in the workbench", page: "items" },
      { label: "Wire shops and crafting recipes", page: "commerce" },
      { label: "Promote zones to jobs or businesses", page: "domains" },
      { label: "Simulate sinks and balance", page: "economy" },
      { label: "Export to your inventory adapter", page: "items" },
    ],
    example:
      "fdt content item-new --id water_bottle → dashboard Commerce → fdt content validate → fdt content export --adapter ox_inventory",
  },
  {
    id: "world",
    title: "World & map builder",
    subtitle: "Place interactions in-game, package MLOs, and audit stream weight.",
    steps: [
      { label: "Export zones from fdt_devtools /fdt", page: "zones" },
      { label: "Manage blips, props, and doors", page: "world" },
      { label: "Scaffold and audit map packages", page: "maps" },
      { label: "Review stream asset inventory", page: "assets" },
    ],
    example:
      "In-game /fdt → import JSON on Zones page → fdt map audit → fdt assets scan",
  },
  {
    id: "qa-release",
    title: "QA & release lead",
    subtitle: "Collect evidence before every promotion to staging or production.",
    steps: [
      { label: "Import or run QA scenarios", page: "qa" },
      { label: "Compare performance snapshots", page: "performance" },
      { label: "Review release diff and checklist", page: "releases" },
      { label: "Confirm CI gates pass", page: "ci" },
    ],
    example:
      "fdt qa validate → import perf snapshot → dashboard Releases → export bundle when checklist passes",
  },
  {
    id: "framework",
    title: "Framework / script developer",
    subtitle: "Understand load order, sync NUI contracts, and debug replication.",
    steps: [
      { label: "Inspect resource dependency graph", page: "graph" },
      { label: "Sync NUI schemas to TypeScript", page: "nui" },
      { label: "Capture state bag snapshots in-game", page: "statebag" },
      { label: "Re-validate after script changes", page: "resources" },
    ],
    example:
      "fdt graph export → fdt nui sync → devtools state bag export → fdt validate resources",
  },
];

const FEATURE_GROUPS = NAV_GROUPS.filter((group) => group.id !== "start");

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
    <PageStack>
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="hero-kicker">FiveM DevOps Toolkit</p>
          <h2 className="hero-title">
            Build, validate, and ship
            <span className="hero-accent"> FiveM servers</span>
          </h2>
          <p className="hero-description">
            Framework-agnostic workflows for resource validation, neutral content authoring, in-game
            devtools, QA, performance tracking, and release automation — scoped to external workspaces
            on your machine. Everything writes to <code className="inline-code">.fdt/</code> beside your
            server, never into this repository.
          </p>
          <div className="hero-stats">
            <div className="stat-card">
              <p className="stat-value">{activeCount}</p>
              <p className="stat-label">Active modules</p>
            </div>
            <div className="stat-card">
              <p className="stat-value capitalize">{phaseLabel(overview?.phase ?? "loading")}</p>
              <p className="stat-label">Current phase</p>
            </div>
            <div className="stat-card">
              <p className="stat-value">{workspaceName ? "1" : "0"}</p>
              <p className="stat-label">Active workspace</p>
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
              Start by registering a server folder, then follow the steps below or pick a workflow that
              matches your role. The sidebar mirrors the same order: setup → validate → world → content →
              ship → deploy.
            </p>
            <button type="button" className="btn btn-primary w-full" onClick={() => onNavigate("workspaces")}>
              {workspaceName ? "Manage workspace" : "Register a workspace"}
            </button>
          </Panel>
        </div>
      </section>

      <OnboardingChecklist onNavigate={onNavigate} />

      <Panel className="panel-compact">
        <PageIntro
          eyebrow="Getting started"
          title="Four steps to your first release"
          description="Run the dashboard with pnpm dev (API on :3001, web on :5173) or use the fdt CLI directly against your workspace."
        />
        <ol className="start-steps">
          {GETTING_STARTED.map((item) => (
            <li key={item.step} className="start-step">
              <div className="start-step-marker" aria-hidden="true">
                {item.step}
              </div>
              <div className="start-step-body">
                <h3 className="start-step-title">{item.title}</h3>
                <p className="start-step-copy">{item.body}</p>
                <code className="inline-code start-step-cli">{item.cli}</code>
                <button type="button" className="btn btn-secondary btn-sm start-step-action" onClick={() => onNavigate(item.page)}>
                  {item.cta}
                </button>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel className="panel-compact">
        <PageIntro
          eyebrow="Workflows"
          title="How different developers use FDT"
          description="Pick the path closest to your day-to-day work — each links to the modules you will open most often."
        />
        <div className="workflow-grid">
          {WORKFLOW_PERSONAS.map((persona) => (
            <article key={persona.id} className="workflow-card">
              <h3 className="workflow-card-title">{persona.title}</h3>
              <p className="workflow-card-subtitle">{persona.subtitle}</p>
              <ol className="workflow-card-steps">
                {persona.steps.map((step) => (
                  <li key={`${persona.id}-${step.page}-${step.label}`}>
                    <button type="button" className="workflow-step-link" onClick={() => onNavigate(step.page)}>
                      {step.label}
                    </button>
                  </li>
                ))}
              </ol>
              <p className="workflow-card-example">
                <span className="workflow-card-example-label">Example</span>
                <code className="inline-code">{persona.example}</code>
              </p>
            </article>
          ))}
        </div>
      </Panel>

      <Panel className="panel-compact">
        <PageIntro
          eyebrow="Feature catalog"
          title="Everything in the toolkit"
          description={`${overview?.name ?? "FiveM DevOps Toolkit"} modules — grouped in the same order as the sidebar.`}
        />
        <div className="feature-catalog">
          {FEATURE_GROUPS.map((group) => (
            <section key={group.id} className="feature-group-block">
              <div className="feature-group-head">
                <h3 className="feature-group-title">{group.label}</h3>
                {group.summary && <p className="feature-group-summary">{group.summary}</p>}
              </div>
              <div className="quick-grid">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="quick-card"
                    onClick={() => onNavigate(item.id)}
                  >
                    <span className="quick-card-label">{item.label}</span>
                    <span className="quick-card-hint">{item.description}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Panel>

      <Panel className="panel-dashed panel-compact">
        <p className="panel-label">Sample external workspace path</p>
        <code className="code-block">E:/FiveMServers/my-server</code>
        <p className="panel-subtext panel-section">
          Try the bundled sample at{" "}
          <code className="inline-code">resources/sample-workspaces/basic-server</code> for demos and CI
          validation.
        </p>
      </Panel>
    </PageStack>
  );
}
