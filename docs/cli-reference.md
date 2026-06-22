# CLI Reference

The `fdt` binary is the command-line interface for all toolkit operations. Run it from the monorepo via `pnpm fdt` or install globally after build.

## Global options

```bash
fdt [global options] <command> [subcommand] [options]
```

| Option | Description |
| --- | --- |
| `--workspace <path>` | Workspace root (directory containing `fdt.workspace.json`) |
| `--config <path>` | Explicit path to workspace config file |
| `--json` | Emit JSON to stdout |
| `--out <path>` | Write primary output to a file |
| `--verbose` | Extra logging |
| `--quiet` | Minimal output |
| `--ci` | CI-friendly formatting and exit codes |
| `--fail-on-warnings` | Exit non-zero on warnings |
| `--env <name>` | Target environment profile (default: `local`) |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Validation or gate failure |
| `2` | Configuration error |
| `10` | Internal/unexpected error |

---

## init

Initialize a new workspace config in the current directory (or `--workspace` path).

```bash
fdt init [--name <name>] [--force]
```

Creates `fdt.workspace.json` and `.fdt/reports/` + `.fdt/exports/`.

---

## scan

Build filesystem indexes.

| Command | Description |
| --- | --- |
| `scan resources` | Scan FiveM resources and build inventory |
| `scan assets` | Index streamed assets in resource stream folders |

---

## validate

| Command | Description |
| --- | --- |
| `validate resources` | Full Resource Doctor validation → `.fdt/reports/resource-doctor.json` |

---

## audit

| Command | Description |
| --- | --- |
| `audit stream` | Stream asset audit (duplicates, size budgets) → `asset-auditor.json` |

Alias: `fdt assets audit`

---

## security

| Command | Description |
| --- | --- |
| `security scan [--resource <name>] [--format json\|sarif] [--ignore-baseline]` | Lua security scan |
| `security baseline create` | Save baseline from latest report |
| `security baseline compare` | Scan and diff against baseline |

---

## content

Framework-agnostic content builders.

| Command | Description |
| --- | --- |
| `content validate` | Validate item registry |
| `content export` | Export items through an adapter |
| `content shops list` | List neutral shop definitions |
| `content crafting list` | List crafting recipes |

---

## adapter

| Command | Description |
| --- | --- |
| `adapter export` | Export registry content through a framework adapter |

---

## release

| Command | Description |
| --- | --- |
| `release create` | Create release candidate from validation reports |
| `release mark` | Update status (qa-ready, deployed, etc.) |
| `release diff` | Compare two release versions |
| `release checklist` | Build QA/deploy checklist |
| `release bundle` | Export release bundle to output directory |

---

## qa

| Command | Description |
| --- | --- |
| `qa validate` | Validate QA scenario registry |
| `qa export-scenarios` | Export scenarios for `fdt_devtools` in-game runner |

---

## ci

| Command | Description |
| --- | --- |
| `ci run` | Run validation, security, and QA gates |
| `ci template` | Generate GitHub Actions workflow |

---

## env

Environment profiles, `server.cfg`, and txAdmin recipes.

| Command | Description |
| --- | --- |
| `env init` | Create default profiles (local, dev, staging, production) |
| `env list` | List profiles |
| `env generate-cfg` | Generate `server.cfg` for a profile |
| `env generate-recipe` | Generate txAdmin YAML recipe scaffold |
| `env validate` | Validate profile (production secret checks) |
| `env diff` | Diff two profiles |

---

## domain

Jobs, gangs, businesses, vehicles, maps.

| Command | Description |
| --- | --- |
| `domain export` | Export domain registries through adapter |
| `domain vehicle` | Vehicle registry subcommands |
| `domain business` | Business builder |
| `domain job` | Job builder |
| `domain gang` | Gang / organization builder |
| `domain map` | Map / MLO package commands |

---

## clothing

| Command | Description |
| --- | --- |
| `clothing pack-new` | Create clothing pack entry |
| `clothing scan` | Index drawables/textures |
| `clothing conflicts` | Detect slot/texture conflicts |
| `clothing export` | Export through adapter |
| `clothing changelog` | Render changelog markdown |

---

## vehicle

| Command | Description |
| --- | --- |
| `vehicle scan` | Scan spawn names and meta files |
| `vehicle audit` | Duplicate/missing meta checks |
| `vehicle compare-handling <a> <b>` | Compare handling.meta |
| `vehicle export` | Export shop entries via adapter |
| `vehicle test-list` | QA spawn command list |

---

## map

| Command | Description |
| --- | --- |
| `map new <resourceName>` | Scaffold map resource |
| `map scan` | Scan stream assets and data files |
| `map audit` | Manifest and documentation audit |
| `map checklist` | Refresh package checklist |
| `map export-test-points` | Export QA teleport points |

---

## graph

| Command | Description |
| --- | --- |
| `graph build` | Build dependency graph from manifests and Lua |
| `graph export` | Export saved graph report |
| `graph find-event <name>` | Find event register/trigger sites |
| `graph impacted` | Resources affected by a change |

---

## nui

| Command | Description |
| --- | --- |
| `nui new <name>` | Scaffold React + Vite NUI resource |
| `nui add-callback <resource> <name>` | Add NUI callback + TS wrapper |
| `nui add-message <resource> <name>` | Add SendNUIMessage action |
| `nui sync [resource]` | Regenerate bridge from `shared/nui-bridge.json` |
| `nui validate` | Validate Lua/TS match bridge schema |
| `nui scan` | List resources with bridge files |
| `nui dev <name>` | Vite dev server for NUI web app |
| `nui build <name>` | Build `web/dist` bundle |

---

## economy

| Command | Description |
| --- | --- |
| `economy simulate` | Simulate income, sinks, vehicle affordability |
| `economy report` | Render markdown simulation report |

---

## world

| Command | Description |
| --- | --- |
| `world list` | List imported blip/prop/door records |

Records are exported from the in-game overlay — see [In-Game Dev Overlay](./in-game-dev-overlay.md).

---

## statebag

| Command | Description |
| --- | --- |
| `statebag list` | List imported snapshots |
| `statebag import <file>` | Import JSON export from `fdt_devtools` |

---

## perf

| Command | Description |
| --- | --- |
| `perf import <file>` | Import performance snapshot JSON |
| `perf compare` | Compare two snapshots |
| `perf report` | Render comparison markdown |

---

## doctor

Run aggregated workspace health checks (planned expansion).

---

## Examples

```bash
# Validate an external server
fdt validate resources --workspace E:/FiveMServers/fdt

# CI pipeline with JSON output
fdt ci run --workspace . --ci --json

# Generate production server.cfg
fdt env generate-cfg --env production --workspace .

# Security scan with SARIF for GitHub
fdt security scan --format sarif --out security.sarif --workspace .
```

## Related

- [Getting Started](./getting-started.md)
- [Dashboard](./dashboard.md) — GUI equivalents for most commands
