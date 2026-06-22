# Asset Auditor

The Asset Auditor indexes streamed files (YDR, YTD, YFT, etc.) across resources, flags duplicate filenames, and enforces configurable size budgets.

## Quick start

```bash
fdt audit stream --workspace <path>
```

Report:

```txt
<workspace>/.fdt/reports/asset-auditor.json
```

Markdown summary (when generated):

```txt
<workspace>/.fdt/reports/asset-auditor.md
```

## Dashboard

Open **Assets** with an active workspace.

| Action | Description |
| --- | --- |
| **Run stream audit** | Full scan and report write |

The page shows total indexed assets, stream size, duplicate filename count, warnings, per-resource size ranking, duplicate groups, and findings.

## Size budgets

Optional budgets in `fdt.workspace.json`:

```json
{
  "assetBudget": {
    "maxResourceMb": 128,
    "maxYtdMb": 32,
    "maxFileMb": 16
  }
}
```

Resources or files exceeding budgets appear as findings (warnings or errors depending on ruleset).

## Duplicate filenames

FiveM resolves stream assets by filename across resources. Two resources shipping `prop_box_01.ydr` under different folders can cause silent overwrites. The auditor groups duplicates by basename and lists every occurrence.

## Scan vs audit

| Command | Purpose |
| --- | --- |
| `scan assets` | Build/search index only |
| `audit stream` | Full audit with findings and report |

## CI

Include in pipeline:

```bash
fdt audit stream --workspace . --ci
```

Asset gate thresholds can fail CI when duplicates or budget violations exceed policy.

## Related

- [Resource Doctor](./resource-doctor.md)
- [CLI Reference — audit](./cli-reference.md#audit)
