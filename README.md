# FiveM DevOps Toolkit

Framework-agnostic development operations suite for GTA V FiveM server development.

FiveM DevOps Toolkit sits around your existing authoring tools (Blender/Sollumz, CodeWalker, OpenIV, txAdmin, QBCore, ESX, ox resources) as a workflow layer for validation, packaging, export, QA, and release automation.

## Monorepo layout

```txt
apps/
  cli/              # fdt CLI
  dashboard-api/    # Fastify API
  dashboard-web/    # React + Vite dashboard
  fdt-devtools-nui/ # FiveM NUI build for fdt_devtools
packages/
  adapters/         # Framework export adapters
  core/             # Shared domain logic
  schemas/          # Zod schemas and types
  scanner/          # Resource scanning and manifest parsing
  validators/       # Resource and content validation
resources/
  fdt_devtools/    # FiveM in-game dev overlay resource
  sample-workspaces/
docker/local/       # Postgres + Redis for local dev
```

## Requirements

- Node.js 20+
- pnpm 10+
- Docker Desktop or Docker Engine (optional, for Postgres/Redis)

## First-time setup

```bash
pnpm install
cp apps/dashboard-api/.env.example apps/dashboard-api/.env
docker compose -f docker/local/docker-compose.yml up -d   # optional
pnpm build
pnpm test
```

## Development

```bash
pnpm dev          # Start dashboard API + web
pnpm test         # Run all package tests
pnpm lint         # Run ESLint
pnpm fdt --help  # Run CLI locally
pnpm fdt init    # Create fdt.workspace.json in any server folder
```

### External workspaces

Use the dashboard **Workspaces** page to create or register FiveM server folders anywhere on disk
(for example `E:/FiveMServers/my-rp`). Each workspace keeps its own `fdt.workspace.json` and
`.fdt/` reports/exports outside this repository.

CLI example for an external workspace:

```bash
pnpm fdt validate resources --workspace E:/FiveMServers/my-rp
```

## Current phase

**Phase 24 — Environment Builder + txAdmin Recipes** (active)

- Environment profiles: local, dev, staging, production (`.fdt/environment/profiles.json`)
- `server.cfg` generator from workspace resources + dependency-aware ensure order
- txAdmin YAML recipe scaffold (`.fdt/exports/txadmin/<env>/recipe.yaml`)
- Production secret/placeholder validation
- Environment diff (convars, secrets, settings, resource order)
- CLI: `fdt env init`, `generate-cfg`, `generate-recipe`, `validate`, `diff`
- Dashboard **Environment** page
- QBCore/ESX/Qbox/ox_inventory adapter exports for shops and crafting recipes

**Completed: Phase 23 — In-Game Overlay World Tools**

## Documentation

### User guides

- [Documentation index](./docs/README.md)
- [Getting Started](./docs/getting-started.md)
- [Workspace Configuration](./docs/workspace-config.md)
- [Dashboard](./docs/dashboard.md)
- [CLI Reference](./docs/cli-reference.md)

### Contributor & agent guides

- [Contributing](./docs/contributing.md)
- [AI Agent Guide](./docs/ai-agent-guide.md)

## License

FiveM DevOps Toolkit is **dual-licensed**:

- **[AGPL-3.0-or-later](./LICENSE)** — free to use, modify, and share under copyleft terms (including obligations when offering modified versions as a network service).
- **[Commercial license](./COMMERCIAL-LICENSE.md)** — for organizations that need to use or distribute FDT without AGPL copyleft requirements. Contact the maintainers for terms.

Unless you have a separate commercial agreement, the AGPL applies.
