# Dashboard

The FiveM DevOps Toolkit dashboard is a React web app for managing workspaces and running module workflows without memorizing CLI commands.

## Running locally

From the toolkit repo root:

```bash
pnpm dev:clean   # if ports 3001 or 5173 are still in use from a prior session
pnpm dev
```

| Service | Default URL |
| --- | --- |
| Web UI | http://localhost:5173 |
| API | http://localhost:3001 |
| Devtools NUI (`pnpm dev:nui`) | http://localhost:5175 |

Configure the API in `apps/dashboard-api/.env` (copy from `.env.example`). The web dev server proxies `/api` requests to the API.

Production build:

```bash
pnpm --filter @fdt/dashboard-web build
pnpm --filter @fdt/dashboard-web preview
```

## Layout

```txt
┌──────────────┬─────────────────────────────────────────┐
│   Sidebar    │  Top bar (page title, workspace name)   │
│   - Search   ├─────────────────────────────────────────┤
│   - Nav      │                                         │
│   - Workspace│  Main content (active module page)      │
│     switcher │                                         │
└──────────────┴─────────────────────────────────────────┘
```

- **Sidebar** — grouped navigation: Core, Content, World, Pipeline, Build
- **Search** — filter modules by name or keyword
- **Workspace switcher** (footer) — quick-select registered servers without opening the Workspaces page
- **Collapse** (desktop) — narrow sidebar to icons only

On mobile/tablet, use the hamburger menu to open the drawer; the close (X) button dismisses it.

## Module map

### Core

| Page | Purpose |
| --- | --- |
| **Overview** | Toolkit status, module count, quick links |
| **Workspaces** | Create, register, validate, framework overrides |
| **Resources** | Resource Doctor report, run validation, import JSON |

### Content

| Page | Purpose |
| --- | --- |
| **Items** | Item registry, validation, adapter export |
| **Commerce** | Shops and crafting recipes |
| **Economy** | Income/sink simulation |
| **Domains** | Jobs, gangs, businesses, vehicles |

### World

| Page | Purpose |
| --- | --- |
| **Zones** | Interaction and territory zones |
| **World Tools** | Blips, props, doors from overlay exports |
| **Assets** | Stream asset auditor |
| **Maps / MLO** | Map package audit and checklists |

### Pipeline

| Page | Purpose |
| --- | --- |
| **Releases** | Release candidates, status, bundles, diffs |
| **QA** | Scenario registry and run history |
| **CI** | Pipeline report and gate status |
| **Security** | Security audit findings and baselines |
| **Performance** | Snapshot comparison |

### Build

| Page | Purpose |
| --- | --- |
| **Environment** | Profiles, server.cfg, txAdmin recipes |
| **Clothing** | Clothing pack scan and conflicts |
| **Vehicles** | Vehicle pack audit |
| **NUI Bridge** | Schema sync for typed NUI |
| **Dependency Graph** | Resource relationships |
| **State Bag** | Entity sync snapshots |

## Workspaces page

Three common actions:

1. **Create New Workspace** — writes `fdt.workspace.json` and `.fdt/` folders on disk
2. **Register Existing** — point at a folder where you already ran `fdt init`
3. **Select** — set the active workspace (also available from the sidebar switcher)

The page shows path checks (server root, resources, server.cfg), detected FXServer artifact build, and framework profile overrides.

## Reports and refresh

Most module pages read reports from `<workspace>/.fdt/reports/`. The API loads reports for the **active workspace only** — switching workspaces updates the page automatically.

Typical actions on module pages:

| Action | Effect |
| --- | --- |
| **Run validation / scan / audit** | Generates fresh report on disk and in memory |
| **Refresh from disk** | Reloads an existing JSON report (Resources page) |
| **Import JSON** | Upload a report file manually |

If a page shows “no report yet”, run the corresponding CLI command or use the on-page action button.

## API status

The sidebar and top bar show **API online/offline**. If the UI loads but data fails, ensure the dashboard API is running on port 3001. Run `pnpm dev:clean` if a stale process is holding the port.

## Related

- [Getting Started](./getting-started.md)
- [Workspace Configuration](./workspace-config.md)
- [CLI Reference](./cli-reference.md)
