# AI Agent Guide — FiveM DevOps Toolkit

This guide is for contributors who utilize AI coding agents working in the FiveM DevOps Toolkit monorepo.

## Read first

1. [README.md](../README.md) — setup and current phase
2. [User Documentation](./README.md) — guides for server owners and operators
3. The phase checklist in this guide (below)

## Architecture rules

- **Framework-agnostic core.** Domain schemas live in `packages/schemas`. Never hard-code QBCore, ESX, or ox logic outside `packages/adapters`.
- **Filesystem-first.** Scan server folders; store indexes and reports in `.fdt/` and the database.
- **Non-destructive by default.** Validate, preview, and export to staging paths. Destructive writes require explicit flags.
- **Deterministic output.** Generated exports must be reproducible from the same workspace config and source data.
- **CI parity.** Anything the dashboard can run should also run via CLI and GitHub Actions.

## Package boundaries

| Package | Responsibility |
|---|---|
| `packages/schemas` | Zod schemas, TypeScript types |
| `packages/core` | Workspace loading, shared contracts |
| `packages/scanner` | Filesystem scanners, manifest/server.cfg parsers |
| `packages/validators` | Validation rules and Resource Doctor |
| `packages/adapters` | Framework export adapters (Phase 2+) |
| `apps/cli` | `fdt` command-line interface |
| `apps/dashboard-api` | HTTP API and background jobs |
| `apps/dashboard-web` | React dashboard UI |
| `apps/fdt-devtools-nui` | FiveM NUI for dev overlay |
| `resources/fdt_devtools` | In-game FiveM resource (Lua + NUI dist) |

## Standard workflow

1. Read the current phase tasks and acceptance criteria.
2. Inspect existing package boundaries before creating new ones.
3. Add tests and fixtures alongside implementation.
4. Keep changes small and reviewable.
5. Run `pnpm test` and `pnpm build` before finishing.
6. Update docs for new CLI commands, schemas, or outputs (user docs in `docs/` + this guide).

## CLI conventions

- Binary name: `fdt`
- Global flags: `--workspace`, `--config`, `--json`, `--out`, `--ci`, `--verbose`, `--quiet`
- Exit codes: `0` success, `1` validation failed, `2` config error, `10` internal error

## Output conventions

Generated artifacts default to `.fdt/`:

```txt
.fdt/
  content/
  performance/
  reports/
  exports/
  releases/
  cache/
  logs/
```

## Phase checklist

- [x] Phase 0 — Foundation
- [x] Phase 1 — Resource Doctor MVP
- [x] Phase 2 — Adapter Core + Item Workbench MVP
- [x] Phase 3 — Asset Auditor MVP
- [x] Phase 4 — In-Game Dev Overlay MVP
- [x] Phase 5 — Release Manager MVP
- [x] Phase 6 — Security Auditor MVP
- [x] Phase 7 — QA Scenario Runner MVP
- [x] Phase 8 — CI/CD Integration MVP
- [x] Phase 10 — Domain Builders MVP
- [x] Phase 9 — Performance Dashboard MVP
- [x] Phase 11 — Jobs & Gangs Domain Builders
- [x] Phase 12 — Clothing Pack Manager
- [x] Phase 13 — Clothing Exports, CI Gate & NUI Starter
- [x] Phase 14 — Qbox Exports, NUI Bridge & CI Hardening
- [x] Phase 15 — Vehicle Pack Builder MVP
- [x] Phase 16 — Map / MLO Packaging Assistant
- [x] Phase 17 — Dependency Graph MVP
- [x] Phase 18 — Typed NUI Schema Sync
- [x] Phase 19 — Economy Simulator MVP
- [x] Phase 20 — State Bag & Entity Sync Visualizer
- [x] Phase 21 — Release Diff, Bundle & Checklist
- [x] Phase 22 — Shop & Crafting Builders
- [x] Phase 23 — In-Game Overlay World Tools (blips, props, doors)
- [x] Phase 24 — Environment Builder + txAdmin Recipes
- [x] Commerce adapter exports — QBCore/ESX/Qbox/ox_inventory shops & crafting

## Task prompt template

```md
Task: <specific task>

Constraints:
- Keep core schemas framework-agnostic
- Add or update tests
- Preserve deterministic generated output
- No destructive writes without dry-run support

Acceptance criteria:
- <criteria>

Before finishing:
- Run pnpm test
- Update docs if needed
```
