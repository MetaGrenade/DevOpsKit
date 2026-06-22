# fdt_devtools

Permission-protected in-game dev overlay for the FiveM DevOps Toolkit.

## Install

1. Copy this folder into your FiveM server `resources/` directory.
2. Build the NUI (from monorepo root):

   ```bash
   pnpm --filter @fdt/devtools-nui build
   ```

3. Add to `server.cfg`:

   ```cfg
   ensure fdt_devtools
   add_ace group.admin fdt.devtools allow
   ```

## Usage

- `/fdt` — open/close the overlay
- `/fdt_export` — export session zones to JSON

## Dashboard import

Set in `config.lua`:

```lua
Config.PostToDashboard = true
Config.DashboardImportUrl = 'http://127.0.0.1:3001/api/v1/zones/import'
```

Ensure the dashboard API has an active workspace selected. Exports are also written to `exports/zones_*.json` when `Config.SaveExportsToResource = true`.

## Security

- Disabled when `Config.Enabled = false`
- Requires ACE permission `fdt.devtools` by default
- Optional identifier allowlist in `config.lua`
