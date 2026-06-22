# Workspace Configuration

Every external FiveM server folder FDT manages is a **workspace**. Configuration lives in `fdt.workspace.json` at the workspace root (or `fdt.config.json` as an alternate filename).

## Minimal example

```json
{
  "schemaVersion": 1,
  "name": "My FiveM Server",
  "serverRoot": "./server",
  "resourcesRoot": "./server/resources",
  "serverCfg": "./server/server.cfg",
  "artifactOutput": "./.fdt/exports",
  "frameworkTargets": ["custom"],
  "rulesets": ["baseline"],
  "resourceIgnore": ["**/.git/**", "**/node_modules/**", "**/dist/**", "**/cache/**"]
}
```

Paths are relative to the workspace root unless you use absolute paths.

## Field reference

| Field | Required | Description |
| --- | --- | --- |
| `schemaVersion` | Yes | Must be `1` |
| `name` | Yes | Display name shown in dashboard and reports |
| `serverRoot` | Yes | Folder containing `server.cfg` and runtime files |
| `resourcesRoot` | Yes | Folder scanned for FiveM resources |
| `serverCfg` | Yes | Path to `server.cfg` |
| `artifactOutput` | No | Default export directory (default: `./.fdt/exports`) |
| `frameworkTargets` | No | Intended export targets: `custom`, `qbcore`, `esx`, `ox`, etc. |
| `rulesets` | No | Validation rule groups (default: `["baseline"]`) |
| `resourceIgnore` | No | Glob patterns skipped during scans |
| `serverArtifactBuild` | No | Pin expected FXServer artifact build number |
| `naming` | No | Resource naming rules (prefix, spaces, case sensitivity) |
| `frameworkProfile` | No | Manual framework/inventory override |
| `assetBudget` | No | Stream asset size limits for the asset auditor |
| `database` | No | Optional DB connection metadata for future phases |

## Framework detection

FDT auto-detects framework and inventory adapters by scanning resource names (e.g. `qb-core`, `es_extended`, `ox_inventory`). Override detection on the **Workspaces** dashboard page or by setting `frameworkProfile` in the config:

```json
{
  "frameworkProfile": {
    "framework": "qbox",
    "inventory": "ox-inventory"
  }
}
```

Detected and manual values are merged; the dashboard shows the source (auto-detected vs manual).

## Output layout

FDT writes all generated artifacts under `.fdt/` inside the workspace:

```txt
.fdt/
  cache/           # Scan indexes and intermediate data
  content/         # Neutral item/shop/crafting registries
  environment/     # Environment profiles (local, dev, staging, production)
  exports/         # Adapter outputs, release bundles, txAdmin recipes
  logs/            # Optional command logs
  performance/     # Performance snapshot registry
  releases/        # Release candidate metadata
  reports/           # JSON and markdown reports
    resource-doctor.json
    asset-auditor.json
    security-audit.json
    ci-pipeline.json
    ...
```

**Important:** Commit `fdt.workspace.json` to your server repo if you want team parity. Treat `.fdt/reports/` as generated output — regenerate in CI rather than hand-editing.

## Dashboard registry

The dashboard keeps a **registry** of registered workspace paths (separate from any single `fdt.workspace.json`). Use the sidebar workspace switcher to change the active workspace without navigating away from your current page.

When you switch workspaces, module pages reload data for the newly selected server.

## Environment profiles

Environment profiles live at `.fdt/environment/profiles.json`. Initialize defaults with:

```bash
fdt env init --workspace <path>
fdt env list --workspace <path>
```

See [CLI Reference — env](./cli-reference.md#env) for `generate-cfg`, `generate-recipe`, `validate`, and `diff`.

## Init defaults

`fdt init` creates a starter config with broader `frameworkTargets` and rulesets than the minimal example above. Review and trim to match your server.

## Related

- [Getting Started](./getting-started.md)
- [Adapters](./adapters.md)
- [Resource Doctor](./resource-doctor.md)
