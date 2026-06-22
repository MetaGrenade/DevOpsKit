# In-Game Dev Overlay

`fdt_devtools` is a FiveM resource bundled with FDT that provides an in-game developer overlay for coordinates, zones, world tools, QA scenarios, and state bag debugging.

## Location

```txt
resources/fdt_devtools/
```

Build the NUI bundle from the toolkit repo:

```bash
pnpm --filter @fdt-devtools-nui build
```

Output copies to `resources/fdt_devtools/web/dist/`.

## Installation

1. Copy or symlink `fdt_devtools` into your server's `resources/` folder
2. Add to `server.cfg`:

   ```cfg
   ensure fdt_devtools
   ```

3. Configure permissions in `resources/fdt_devtools/config.lua` — restrict to admin/dev ACE principals only

## Features

| Feature | Description |
| --- | --- |
| **Coordinates** | Copy vector3/vector4, heading |
| **Zones** | Draw and export interaction zones → workspace registry |
| **Blips / Props / Doors** | World placement records → `.fdt/content/world/` |
| **QA runner** | Execute exported QA scenarios |
| **State bag** | Snapshot entity state for dashboard visualizer |

## Export flow

```txt
In-game overlay → export JSON → import via dashboard or CLI
```

Examples:

```bash
fdt world list --workspace <path>
fdt statebag import export.json --workspace <path>
```

Dashboard **World Tools** and **State Bag** pages display imported records.

## QA scenarios

Export scenarios from workspace to devtools:

```bash
fdt qa export-scenarios --workspace <path>
```

See [QA Scenarios](./qa-scenarios.md).

## Security

- Never deploy with open permissions on production
- Overlay exports write to server-side files — validate paths
- Treat exported coordinates as dev-only until reviewed

## NUI development

Scaffold new NUI resources with typed bridges:

```bash
fdt nui new my-hud --workspace <path>
fdt nui dev my-hud --workspace <path>
fdt nui build my-hud --workspace <path>
```

See [CLI Reference — nui](./cli-reference.md#nui) and dashboard **NUI Bridge**.

## Related

- [QA Scenarios](./qa-scenarios.md)
- [Dashboard — World / State Bag / Zones](./dashboard.md)
- [CLI Reference — world & statebag](./cli-reference.md)
