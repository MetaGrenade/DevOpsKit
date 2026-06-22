RegisterNetEvent('fdt:statebag:requestOpen', function()
    local src = source
    if not FDT_HasPermission(src) then
        TriggerClientEvent('fdt:statebag:openDenied', src)
        return
    end

    TriggerClientEvent('fdt:statebag:openAllowed', src)
end)

RegisterNetEvent('fdt:statebag:export', function(snapshot)
    local src = source
    if not FDT_HasPermission(src) then
        TriggerClientEvent('fdt:statebag:exportResult', src, {
            ok = false,
            message = 'Permission denied.',
        })
        return
    end

    if type(snapshot) ~= 'table' then
        TriggerClientEvent('fdt:statebag:exportResult', src, {
            ok = false,
            message = 'Invalid snapshot payload.',
        })
        return
    end

    snapshot.exportedAt = os.date('!%Y-%m-%dT%H:%M:%SZ')
    snapshot.exportedBy = FDT_GetPrimaryIdentifier(src)

    local payload = {
        schemaVersion = 1,
        exportedAt = snapshot.exportedAt,
        exportedBy = snapshot.exportedBy,
        resource = 'fdt_devtools',
        snapshot = snapshot,
    }

    local filePath = nil
    if Config.SaveExportsToResource then
        local resourcePath = GetResourcePath(GetCurrentResourceName())
        local exportDir = resourcePath .. '/exports'
        os.execute('mkdir "' .. exportDir:gsub('/', '\\') .. '" 2>nul')
        local fileName = ('statebag_%s.json'):format(os.date('%Y%m%d_%H%M%S'))
        filePath = exportDir .. '/' .. fileName
        local file = io.open(filePath, 'w')
        if file then
            file:write(json.encode(payload))
            file:close()
        end
    end

    if Config.PostStateBagToDashboard and Config.DashboardStateBagImportUrl and Config.DashboardStateBagImportUrl ~= '' then
        PerformHttpRequest(
            Config.DashboardStateBagImportUrl,
            function(statusCode, _, _)
                print(('[fdt_devtools] State bag dashboard import HTTP %s'):format(tostring(statusCode)))
            end,
            'POST',
            json.encode(payload),
            { ['Content-Type'] = 'application/json' }
        )
    end

    TriggerClientEvent('fdt:statebag:exportResult', src, {
        ok = true,
        message = 'State bag snapshot exported.',
        filePath = filePath,
        payload = payload,
    })
end)
