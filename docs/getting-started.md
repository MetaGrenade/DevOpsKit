# Getting Started

FiveM DevOps Toolkit (FDT) wraps your existing FiveM server folder with validation, content authoring, QA, and release workflows. It does **not** replace Blender, CodeWalker, txAdmin, or your framework — it sits beside them.

## Requirements

- **Node.js 20+**
- **pnpm 10+**
- A FiveM server directory on disk (can live anywhere, e.g. `E:/FiveMServers/my-rp`)
- Optional: Docker for Postgres/Redis (future phases)

## Install the toolkit

Clone or download this repository, then from the repo root:

```bash
pnpm install
cp apps/dashboard-api/.env.example apps/dashboard-api/.env
pnpm build
pnpm test
```

## Create your first workspace

A **workspace** is any FiveM server folder that contains `fdt.workspace.json`. FDT reads your `server/`, `resources/`, and `server.cfg` from paths in that file.

### Option A — CLI (in your server folder)

```bash
cd E:/FiveMServers/my-rp
pnpm fdt init --name "My RP Server"
pnpm fdt validate resources --workspace .
```

This creates:

```txt
my-rp/
  fdt.workspace.json
  .fdt/
    reports/
    exports/
```

### Option B — Dashboard

1. Start the dev stack from the toolkit repo:

   ```bash
   pnpm dev
   ```

2. Open **http://localhost:5173**
3. Go to **Workspaces** → **Create New Workspace** or **Register Existing**
4. Use **Browse** to pick folders — you do not need to type paths manually

The dashboard registers workspaces in a local registry and lets you switch between them from the sidebar footer.

## Typical workflow

```txt
1. Register workspace (CLI init or dashboard)
2. Run validation          →  fdt validate resources
3. Audit stream assets     →  fdt audit stream
4. Security scan           →  fdt security scan
5. Author content          →  dashboard Items / Commerce / Domains
6. Export via adapter      →  fdt content export / fdt adapter export
7. Build release           →  fdt release create
8. Run CI gates            →  fdt ci run
```

Reports land in `<workspace>/.fdt/reports/`. Exports land in `<workspace>/.fdt/exports/`. Nothing is mixed into the FDT repository itself.

## CLI basics

Every command accepts a workspace path:

```bash
pnpm fdt validate resources --workspace E:/FiveMServers/my-rp
pnpm fdt --workspace E:/FiveMServers/my-rp audit stream
pnpm fdt --workspace E:/FiveMServers/my-rp --json security scan
```

Global flags (see [CLI Reference](./cli-reference.md)):

| Flag | Purpose |
| --- | --- |
| `--workspace <path>` | Workspace root directory |
| `--config <path>` | Override config file path |
| `--json` | Machine-readable output |
| `--ci` | CI-friendly exit codes and output |
| `--out <path>` | Write report to a file |

Exit codes: `0` success · `1` validation failed · `2` config error · `10` internal error

## Dashboard basics

| URL | Service |
| --- | --- |
| http://localhost:5173 | Web UI (Vite dev) |
| http://localhost:3001 | API |

The web UI proxies `/api` to the API. Select an active workspace in the sidebar before running module actions — Resources, Assets, Security, and others scope to the active workspace.

See [Dashboard](./dashboard.md) for the full module map.

## Sample workspace

The repo includes a sample server at:

```txt
resources/sample-workspaces/basic-server/
```

Use it to explore reports and dashboard features without touching a production server.

## Next steps

- [Workspace Configuration](./workspace-config.md) — tune paths, frameworks, and budgets
- [Resource Doctor](./resource-doctor.md) — your first validation report
- [CLI Reference](./cli-reference.md) — full command list
- [Adapters](./adapters.md) — export items and commerce to QBCore/ESX/Qbox/ox
