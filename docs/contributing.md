# Contributing

Thank you for contributing to FiveM DevOps Toolkit. This guide covers local development for humans; AI agents should also read [AI Agent Guide](./ai-agent-guide.md).

**Repository:** [https://github.com/MetaGrenade/DevOpsKit](https://github.com/MetaGrenade/DevOpsKit) — open issues and pull requests there.

## Prerequisites

- Node.js 20+
- pnpm 10+
- Git

Optional: Docker for Postgres/Redis (`docker compose -f docker/local/docker-compose.yml up -d`)

## Setup

```bash
pnpm install
cp apps/dashboard-api/.env.example apps/dashboard-api/.env
pnpm build
pnpm test
```

## Development commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Dashboard API (3001) + web (5173); package TypeScript watch |
| `pnpm dev:clean` | Free dev ports after a stuck or duplicate session |
| `pnpm dev:nui` | In-game devtools NUI Vite server (5175) |
| `pnpm test` | All package tests |
| `pnpm build` | Build all packages |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript project references |
| `pnpm fdt --help` | CLI entry |

See [CHANGELOG.md](../CHANGELOG.md) for release history.

Run targeted tests:

```bash
pnpm --filter @fdt/validators test
pnpm --filter @fdt/dashboard-api test
```

## Architecture principles

1. **Framework-agnostic core** — schemas in `packages/schemas`, no QBCore/ESX logic outside `packages/adapters`
2. **Filesystem-first** — scan external workspaces; store under `.fdt/`
3. **Non-destructive defaults** — validate and preview before write; destructive ops need explicit flags
4. **Deterministic output** — sorted keys, stable formatting for exports and reports
5. **CI parity** — if the dashboard can run it, CLI and `fdt ci run` should too

## Package map

| Path | Role |
| --- | --- |
| `packages/schemas` | Zod schemas and types |
| `packages/core` | Workspace loading, builders |
| `packages/scanner` | Manifest and cfg parsers |
| `packages/validators` | Resource Doctor, security, asset rules |
| `packages/adapters` | Framework exporters |
| `apps/cli` | `fdt` CLI |
| `apps/dashboard-api` | Fastify HTTP API |
| `apps/dashboard-web` | React dashboard |
| `resources/fdt_devtools` | FiveM overlay resource |

## Adding features

Typical flow:

1. Schema in `packages/schemas`
2. Core logic in `packages/core` or `packages/validators`
3. CLI command in `apps/cli/src/commands/`
4. API route in `apps/dashboard-api/src/<module>/`
5. Dashboard page in `apps/dashboard-web/src/pages/`
6. Tests + fixtures alongside implementation
7. User docs in `docs/` and update [docs/README.md](./README.md)

## Tests and fixtures

- Unit tests: Vitest in each package
- API route tests: `app.inject()` against Fastify
- Fixtures: `resources/sample-workspaces/` and package-local `fixtures/`

Add fixtures when changing scan or validation behavior.

## Code style

- TypeScript strict mode
- ESLint + Prettier (run `pnpm format` before large doc edits)
- Match existing naming in the package you edit
- Minimal scope per PR

## Documentation

Update user docs when adding CLI commands, dashboard pages, or export formats:

- [docs/README.md](./README.md) — index
- Relevant module guide
- [CLI Reference](./cli-reference.md)

## Pull requests

Include:

- What changed and why
- Test commands run
- Acceptance evidence (report snippets, screenshots for UI)
- Doc updates if behavior is user-visible

## License

By contributing to [https://github.com/MetaGrenade/DevOpsKit](https://github.com/MetaGrenade/DevOpsKit), you agree that your contributions are licensed under the project’s **[AGPL-3.0-or-later](../LICENSE)** (see also [Commercial License](../COMMERCIAL-LICENSE.md) for the dual-licensing model). Do not submit material you cannot license on those terms.

## Related

- [AI Agent Guide](./ai-agent-guide.md)
