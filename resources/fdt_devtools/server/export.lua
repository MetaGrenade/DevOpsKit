local function ensureExportDir()
    local resourcePath = GetResourcePath(GetCurrentResourceName())
    local exportDir = resourcePath .. '/exports'
    os.execute('mkdir "' .. exportDir:gsub('/', '\\') .. '" 2>nul')
    return exportDir
end

function FDT_PostExport(payload, url, enabled)
    if not enabled or not url or url == '' then
        return
    end

    PerformHttpRequest(
        url,
        function(statusCode, _, _)
            print(('[fdt_devtools] Dashboard import HTTP %s'):format(tostring(statusCode)))
        end,
        'POST',
        json.encode(payload),
        { ['Content-Type'] = 'application/json' }
    )
end

function FDT_SaveExport(payload, prefix)
    if not Config.SaveExportsToResource then
        return nil
    end

    local exportDir = ensureExportDir()
    local fileName = ('%s_%s.json'):format(prefix or 'export', os.date('%Y%m%d_%H%M%S'))
    local filePath = exportDir .. '/' .. fileName
    local file = io.open(filePath, 'w')

    if not file then
        print('[fdt_devtools] Failed to write export file.')
        return nil
    end

    file:write(json.encode(payload))
    file:close()
    return filePath
end

function FDT_BuildExportPayload(source, zones)
    return {
        schemaVersion = 1,
        exportedAt = os.date('!%Y-%m-%dT%H:%M:%SZ'),
        exportedBy = FDT_GetPrimaryIdentifier(source),
        resource = 'fdt_devtools',
        zones = zones,
    }
end

function FDT_ExportZones(source, zones)
    if #zones == 0 then
        return {
            ok = false,
            message = 'No zones to export.',
        }
    end

    local payload = FDT_BuildExportPayload(source, zones)
    local filePath = FDT_SaveExport(payload, 'zones')
    FDT_PostExport(payload, Config.DashboardImportUrl, Config.PostToDashboard)

    return {
        ok = true,
        message = 'Zones exported.',
        filePath = filePath,
        payload = payload,
    }
end

function FDT_ExportWorld(source, world)
    local payload = {
        schemaVersion = 1,
        exportedAt = os.date('!%Y-%m-%dT%H:%M:%SZ'),
        exportedBy = FDT_GetPrimaryIdentifier(source),
        resource = 'fdt_devtools',
        blips = world.blips or {},
        props = world.props or {},
        doors = world.doors or {},
    }

    local filePath = FDT_SaveExport(payload, 'world')
    FDT_PostExport(payload, Config.DashboardWorldImportUrl, Config.PostWorldToDashboard)

    return {
        ok = true,
        message = 'World data exported.',
        filePath = filePath,
        payload = payload,
    }
end
