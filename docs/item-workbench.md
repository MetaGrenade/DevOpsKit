# Item Workbench

The Item Workbench manages a **framework-neutral item registry** in your workspace. Define items once, validate them, then export to QBCore, ESX, Qbox, ox_inventory, or custom JSON.

## Registry location

```txt
<workspace>/.fdt/content/items.json
```

Author items via the dashboard **Items** page or by editing the JSON registry directly (validate after manual edits).

## Workflow

```txt
1. Add items (dashboard or JSON)
2. Validate registry
3. Export through adapter
4. Deploy generated files to your framework resources
```

### CLI

```bash
# Validate duplicate IDs, missing icons, schema issues
fdt content validate --workspace <path>

# Export to adapter output paths
fdt content export --workspace <path>
```

Use `fdt adapter export` for broader adapter exports including items.

## Item fields

Items follow the schema in `packages/schemas` (neutral format). Typical fields:

- `id` — unique item identifier
- `label`, `description`
- `weight`, `stack`, `consume`
- `image` — icon path reference
- Framework-specific metadata in extension blocks where needed

Run validation to see schema errors with line-level messages.

## Dashboard

The **Items** page provides:

- Registry list and editor
- Validation results
- Export preview and adapter selection
- Framework profile awareness (uses detected or manual override)

## Commerce linkage

Items referenced by shops and crafting recipes should exist in the registry before export. See dashboard **Commerce** and:

```bash
fdt content shops list --workspace <path>
fdt content crafting list --workspace <path>
```

## Adapters

Export targets and output paths vary by framework — see [Adapters](./adapters.md).

| Adapter | Typical item output |
| --- | --- |
| ox-inventory | `data/items.lua` fragments |
| qbcore / qbox | Shared item definitions |
| esx | JSON item list |
| custom-json | Portable JSON in `.fdt/exports/` |

## Related

- [Adapters](./adapters.md)
- [CLI Reference — content](./cli-reference.md#content)
- [Dashboard — Items](./dashboard.md)
