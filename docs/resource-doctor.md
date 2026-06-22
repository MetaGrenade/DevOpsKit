# Resource Doctor

Resource Doctor validates FiveM resources in your workspace: manifest structure, dependency references, naming, server.cfg alignment, and baseline ruleset checks.

## Quick start

```bash
fdt validate resources --workspace <path>
```

Report output:

```txt
<workspace>/.fdt/reports/resource-doctor.json
```

## Dashboard

Open **Resources** in the dashboard (with an active workspace selected).

| Action | Description |
| --- | --- |
| **Run validation** | Same as CLI — scans all resources and writes report |
| **Refresh from disk** | Reload existing JSON if you ran CLI elsewhere |
| **Import JSON** | Upload a report from another machine |

The page shows summary counts (scanned, errors, warnings, passed), findings list, and full resource inventory.

## Report structure

Key fields in `resource-doctor.json`:

| Section | Contents |
| --- | --- |
| `summary` | Counts by severity |
| `resources` | Name, path, category per resource |
| `findings` | Severity, code, message, optional resource reference |
| `serverCfg` | Started/ensured resource lists vs disk |

Findings use stable `code` identifiers suitable for CI filtering.

## Rulesets

Configure active rules in `fdt.workspace.json`:

```json
{
  "rulesets": ["baseline", "performance", "security", "asset-streaming"]
}
```

Additional rulesets ship with the validators package; enable only what your pipeline needs.

## CI integration

```bash
fdt validate resources --workspace . --ci --fail-on-warnings
```

Or run the full gate suite:

```bash
fdt ci run --workspace .
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| “No report found” | Run validation at least once |
| Stale data after workspace switch | Switch workspace in sidebar — page reloads automatically |
| Wrong server scanned | Check active workspace path in sidebar footer |
| Paths not found | Fix `serverRoot`, `resourcesRoot`, `serverCfg` in config |

## Related

- [Workspace Configuration](./workspace-config.md)
- [CLI Reference — validate](./cli-reference.md#validate)
- [Security Auditor](./security-auditor.md)
