# Changelog

All notable changes to [FiveM DevOps Toolkit](https://github.com/MetaGrenade/DevOpsKit) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.0-alpha] - 2026-06-22

First public alpha — FiveM DevOps Toolkit (FDT) MVP with passing GitHub **FDT CI** and **FDT Validate** workflows.

### Added

- **`fdt` CLI** — workspace init, resource validation, security scanning, QA, CI pipeline, content and domain builders, environment profiles, txAdmin recipe export, and framework adapters (QBCore, ESX, Qbox, ox_inventory, ox_appearance, custom JSON).
- **Dashboard** — React web UI and Fastify API for workspaces, resources, security, CI, releases, maps, vehicles, clothing, economy, environment, NUI schema sync, and more.
- **`fdt_devtools`** — permission-protected in-game dev overlay (coordinates, zones, blips, props, doors, QA, state bags).
- **Monorepo packages** — `@fdt/schemas`, `@fdt/core`, `@fdt/scanner`, `@fdt/validators`, `@fdt/adapters`.
- **Sample workspace** — `resources/sample-workspaces/basic-server` for demos and CI validation.
- **Dual licensing** — AGPL-3.0-or-later plus commercial license path ([`COMMERCIAL-LICENSE.md`](./COMMERCIAL-LICENSE.md)).
- **GitHub Actions** — `FDT CI` (build, test, lint, CLI smoke) and `FDT Validate` (sample workspace pipeline + SARIF upload).
- **Repository attribution** — [https://github.com/MetaGrenade/DevOpsKit](https://github.com/MetaGrenade/DevOpsKit) in `LICENSE`, `COMMERCIAL-LICENSE.md`, root `package.json`, docs, and `fdt_devtools` manifest.
- **`pnpm dev:clean`** — frees dev ports 3001, 5173, 5174, and 5175 after a stuck session.
- **`pnpm dev:nui`** — in-game devtools NUI Vite server on port **5175**.
- **`CHANGELOG.md`** — project release history (this file).

### Changed

- Product branding — **FiveM DevOps Toolkit** (`fdt` CLI, `.fdt/` workspace dir, `fdt.workspace.json`, `@fdt/*` packages).
- **`pnpm dev`** — dashboard API + web and package TypeScript watchers only; excludes `@fdt/devtools-nui` so the web UI keeps port **5173**.
- **Dashboard web** — Vite `strictPort: true` on port 5173.
- **Devtools NUI** — dedicated dev port **5175** with `strictPort: true`.
- **Root `fdt` script** — `node apps/cli/dist/index.js` for reliable execution on Linux CI runners.
- **GitHub Actions** — pnpm version from `packageManager`; Node.js **24**; CodeQL upload-sarif **v4**; conditional report/SARIF uploads via `hashFiles`.
- **Validate workflow** — sample workspace security gate is report-only so intentional demo vulnerabilities do not fail monorepo CI.

### Fixed

- GitHub CI — pnpm version mismatch (`ERR_PNPM_BAD_PM_VERSION`).
- GitHub CI — `fdt: not found` in validate workflow.
- GitHub CI — dashboard-api tests failing without gitignored `.fdt/` report fixtures on disk.
- GitHub CI — monorepo ESLint failures (unused imports, regex escapes, `prefer-const`) across apps and packages.
- Local dev — port conflicts when `fdt-devtools-nui` and `dashboard-web` both started under `pnpm dev`.
- Local dev — dashboard API `EADDRINUSE` on port 3001 now suggests `pnpm dev:clean`.

[Unreleased]: https://github.com/MetaGrenade/DevOpsKit/compare/v0.0.0-alpha...HEAD
[0.0.0-alpha]: https://github.com/MetaGrenade/DevOpsKit/releases/tag/v0.0.0-alpha
