# Changelog

All notable changes to [FiveM DevOps Toolkit](https://github.com/MetaGrenade/DevOpsKit) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Dashboard **light / dark / system** theme — `ThemeToggle`, CSS variable tokens, and inline bootstrap in `index.html` to apply theme before first paint.
- Shared dashboard UI primitives — `PageStack`, `PageIntro`, `PageAlert`, `Panel`, `StatGrid`, `NotePanel`, and semantic form/table/button classes in `index.css`.
- **Overview** getting-started guide — four-step onboarding, five developer workflow personas (DevOps, content, world/map, QA/release, framework), CLI examples, and a feature catalog grouped like the sidebar.
- Sidebar navigation grouped by intended workflow — **Start → Validate → World → Content → Ship → Deploy**.
- **Command palette** (`⌘K` / `Ctrl+K`) — fuzzy search across every module plus quick theme switching, with full keyboard navigation; top-bar search trigger added.
- **Toast notification system** — global `ToastProvider` / `useToast()` with success/error/warning/info tones and auto-dismiss.
- In-app **Docs & Help** page — getting started, daily workflow, data-driven module reference, keyboard shortcuts, and a CLI cheatsheet, linked from the Start group.
- Shared **ThemeProvider** context so the top-bar toggle and command palette stay in sync.
- New UI primitives — `Kbd`, `Tooltip`, `Skeleton` / `SkeletonText`, and `SegmentedControl`.
- Design system v2 tokens — elevation ramp (`--surface-1..3`), accent ramp, motion/easing tokens, focus-visible ring system, and a max-width content container.

### Changed

- Page loader now renders skeleton placeholders instead of a spinner for better perceived performance.
- Dashboard typography — **Plus Jakarta Sans** (UI), **Outfit** (headings), and **JetBrains Mono** (code); unified type scale, label tracking, and heading letter-spacing.
- Dashboard contrast — stronger ink/muted/label tokens, panel shadows, and borders in both light and dark themes; light canvas shifted to `#e2e8f0` for clearer surface separation.
- Dashboard app shell top bar — page title and theme toggle only; workspace name and API status remain in the sidebar.
- All dashboard pages migrated from legacy hardcoded Tailwind (`bg-[#…]`, `border-white/10`, `text-slate-*`) to the semantic theme system.
- **Overview** redesigned from a module status grid to a feature list and workflow breakdown.
- Sidebar item order, group labels, and descriptions updated to match regular FDT usage.
- Dashboard scroll performance — removed sticky topbar `backdrop-filter`, lighter panel shadows, solid topbar backgrounds, and `content-visibility` on off-screen page sections.
- Dashboard scrollbars — themed thin scrollbars on main content, sidebar, tables, and modals (Firefox + WebKit).

### Fixed

- **Releases** page — missing closing wrapper after validation stats (build-breaking JSX).
- **Vehicles** page — unused imports after theme migration.

## [0.0.1-alpha] - 2026-06-22

### Added

- Sample workspace **auto-initializes** environment profiles (local, dev, staging, production) when the dashboard loads workspaces.

### Changed

- Environment API — `GET /environment/profiles` returns **404** when no profiles exist, so the UI shows the initialize prompt instead of a broken empty state.
- Environment API — generate, validate, recipe, and diff endpoints return **404/400** with clear messages instead of HTTP 500.
- Environment page — surfaces API error messages; syncs diff **From/To** selects when profiles load; disables actions when profiles are missing.

### Fixed

- Environment Builder — generate `server.cfg`, txAdmin recipe, and validate actions failed on fresh clones because `.fdt/environment/profiles.json` was never created.
- Environment diff — empty **From/To** dropdowns when profiles were not loaded.

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

[Unreleased]: https://github.com/MetaGrenade/DevOpsKit/compare/v0.0.1-alpha...HEAD
[0.0.1-alpha]: https://github.com/MetaGrenade/DevOpsKit/compare/v0.0.0-alpha...v0.0.1-alpha
[0.0.0-alpha]: https://github.com/MetaGrenade/DevOpsKit/releases/tag/v0.0.0-alpha
