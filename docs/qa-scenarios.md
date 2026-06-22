# QA Scenarios

QA Scenarios define repeatable in-game test flows executed through the `fdt_devtools` overlay. Scenarios validate coordinates, interactions, economy flows, and regression checks after content changes.

## Registry

Scenarios live in the workspace QA registry (managed via dashboard **QA** page and validated by CLI).

```bash
fdt qa validate --workspace <path>
```

## Export for in-game runner

```bash
fdt qa export-scenarios --workspace <path>
```

Exports scenario JSON consumed by `resources/fdt_devtools/data/qa-scenarios.json` (or synced path configured in your devtools resource).

## In-game execution

1. Ensure `fdt_devtools` is installed and `ensure`d on your dev server
2. Grant dev permissions (see [In-Game Dev Overlay](./in-game-dev-overlay.md))
3. Open overlay → QA panel → run scenario

Results can be exported back to the workspace for dashboard review.

## Dashboard

**QA** page provides:

- Scenario list and editor
- Validation errors (missing steps, bad coordinates)
- Run history when imported from devtools
- Link to release QA summary

## CI

`fdt qa validate` runs in `fdt ci run`. Invalid scenarios fail the gate before release promotion.

## Writing scenarios

Each scenario typically includes:

- `id`, `name`, `description`
- Ordered **steps** (teleport, wait, keypress, assert zone, etc.)
- Optional tags for filtering (smoke, economy, jobs)

Keep scenarios idempotent where possible — reset state in setup steps.

## Related

- [In-Game Dev Overlay](./in-game-dev-overlay.md)
- [Releases](./releases.md)
- [CLI Reference — qa](./cli-reference.md#qa)
