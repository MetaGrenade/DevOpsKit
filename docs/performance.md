# Performance

The Performance module imports server/client performance snapshots, compares runs over time, and highlights regressions in resource timing, tick metrics, or custom markers.

## Snapshot import

```bash
fdt perf import snapshot.json --workspace <path>
```

Snapshots store in the workspace performance registry under `.fdt/performance/`.

Capture snapshots from your profiling workflow (Resmon exports, custom instrumentation, or future devtools integration) as JSON matching the FDT performance schema.

## Compare runs

```bash
fdt perf compare --baseline <id> --target <id> --workspace <path>
fdt perf report --workspace <path>
```

Comparison report:

```txt
<workspace>/.fdt/reports/performance-comparison.json
```

Markdown report available via `perf report`.

## Dashboard

**Performance** page shows:

- Imported snapshots list
- Comparison charts/tables (regressions highlighted)
- Threshold indicators when configured

Select baseline and target snapshots to generate a new comparison from the UI.

## CI usage

Import baseline snapshot in CI, compare against a fresh capture after changes, fail on regression beyond threshold (when `--ci` thresholds configured).

## Tips

- Tag snapshots with git SHA and date in the import filename
- Run comparisons on the same hardware where possible
- Focus on resources changed in the release diff

## Related

- [Releases](./releases.md)
- [CLI Reference — perf](./cli-reference.md#perf)
- [Resource Doctor](./resource-doctor.md)
