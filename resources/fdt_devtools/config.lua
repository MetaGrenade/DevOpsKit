Config = {}

-- Master switch. Set false on production servers unless explicitly needed.
Config.Enabled = true

-- Require ACE permission (recommended). Grant with:
-- add_ace group.admin fdt.devtools allow
Config.RequireAce = true
Config.AcePermission = 'fdt.devtools'

-- Optional license/identifier allowlist (checked in addition to ACE when RequireAce is false,
-- or as fallback when RequireAce is true and player lacks ACE but is listed here).
Config.IdentifierAllowlist = {
    -- 'license:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
}

-- Post exports directly to the FiveM DevOps Toolkit dashboard API.
Config.PostToDashboard = false
Config.DashboardImportUrl = 'http://127.0.0.1:3001/api/v1/zones/import'

-- Post completed QA runs to the dashboard API.
Config.PostQaRunToDashboard = false
Config.DashboardQaImportUrl = 'http://127.0.0.1:3001/api/v1/qa/runs/import'

-- State bag visualizer
Config.StateBagWatchKeys = {
    'isLoggedIn',
    'job',
    'gang',
    'dead',
    'invBusy',
    'invOpen',
}
Config.StateBagStaleMs = 15000
Config.StateBagRaycastDistance = 12.0
Config.PostStateBagToDashboard = false
Config.DashboardStateBagImportUrl = 'http://127.0.0.1:3001/api/v1/statebag/import'

-- Write JSON exports under this resource's exports/ folder.
Config.SaveExportsToResource = true

-- Draw debug markers for session zones while overlay is open.
Config.DrawZoneMarkers = true
Config.DrawWorldMarkers = true
Config.DefaultPropModel = 'prop_cs_box_clothes'

Config.PostWorldToDashboard = false
Config.DashboardWorldImportUrl = 'http://127.0.0.1:3001/api/v1/world/import'
