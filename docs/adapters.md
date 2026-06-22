# Adapters

Adapters translate FDT's neutral content registries into framework-specific files your server already uses. Core schemas stay framework-agnostic; adapter logic lives in `packages/adapters`.

## Supported adapters

| ID | Framework / stack | Typical exports |
| --- | --- | --- |
| `qbcore` | QBCore | Items, jobs, shops, crafting Lua |
| `qbox` | Qbox | Items, shops, crafting in qbx resources |
| `esx` | ESX | Items, shops JSON, crafting JSON |
| `ox-inventory` | ox_inventory | Items, shops Lua, crafting Lua |
| `ox-appearance` | ox_appearance | Clothing pack outputs |
| `custom-json` | Any | Portable JSON to `.fdt/exports/` |

The dashboard auto-detects installed resources and recommends an adapter. Override on **Workspaces** if detection is wrong.

## Export commands

```bash
# Items and general content
fdt content export --workspace <path>

# Full adapter export (items, domains, clothing, vehicles, etc.)
fdt adapter export --workspace <path>
```

Use `--json` to inspect export plan without writing files where supported.

## Commerce exports

Shops and crafting recipes export to framework-specific paths:

| Framework | Shops | Crafting |
| --- | --- | --- |
| QBCore | `shared/fdt_shops.lua` | `shared/fdt_crafting.lua` |
| Qbox | `qbx_shops/...` | `qbx_crafting/...` |
| ESX | `esx/shops.json` | `esx/crafting_recipes.json` |
| ox_inventory | `data/shops.fdt.lua` | `data/crafting.fdt.lua` |

Author neutral definitions in dashboard **Commerce**, then export. Generated filenames use `.fdt` suffix where needed to avoid overwriting your hand-maintained files — review and merge into production paths.

## Clothing and vehicles

```bash
fdt clothing export --workspace <path>
fdt vehicle export --workspace <path>
fdt domain export --workspace <path>
```

Clothing uses drawable/texture metadata from pack scans. Vehicles export shop spawn entries and metadata from the vehicle registry.

## Deterministic output

Adapters sort keys and normalize formatting so the same registry produces identical output across runs. Do not edit generated files in `.fdt/exports/` by hand — change the neutral registry and re-export.

## Adding a custom target

For servers without a built-in adapter:

1. Export with `custom-json`
2. Transform JSON in your own resource pipeline, or
3. Contribute a new adapter in `packages/adapters` (see [Contributing](./contributing.md))

## Related

- [Item Workbench](./item-workbench.md)
- [CLI Reference — adapter & content](./cli-reference.md)
- [Workspace Configuration — frameworkProfile](./workspace-config.md)
