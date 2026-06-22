CreateThread(function()
    while true do
        if FDT.IsNuiOpen() then
            local coords, heading = FDT.GetPlayerCoords()
            SendNUIMessage({
                type = 'coords',
                coords = coords,
                heading = heading,
                vector3 = FDT.Vector3String(coords),
                vector4 = FDT.Vector4String(coords, heading),
            })
            Wait(100)
        else
            Wait(500)
        end
    end
end)

FDT.PendingTab = nil

local function requestOpen()
    if not Config.Enabled then
        TriggerEvent('chat:addMessage', {
            color = { 255, 180, 80 },
            args = { 'FDT', 'DevTools are disabled on this server.' },
        })
        return
    end

    TriggerServerEvent('fdt:devtools:requestOpen')
end

RegisterCommand('fdt', function()
    if FDT.IsNuiOpen() then
        FDT.SetNuiOpen(false)
        SendNUIMessage({ type = 'visible', visible = false })
        return
    end

    requestOpen()
end, false)

RegisterCommand('fdt_coords', function()
    requestOpen()
end, false)

RegisterCommand('fdt_zone', function()
    FDT.PendingTab = 'zones'
    requestOpen()
end, false)

RegisterCommand('fdt_blip', function()
    FDT.PendingTab = 'blips'
    requestOpen()
end, false)

RegisterCommand('fdt_prop', function()
    FDT.PendingTab = 'props'
    requestOpen()
end, false)

RegisterCommand('fdt_door', function()
    FDT.PendingTab = 'doors'
    requestOpen()
end, false)

RegisterCommand('fdt_export', function()
    if not FDT.HasPermission() then
        requestOpen()
        return
    end

    TriggerServerEvent('fdt:devtools:exportZones')
end, false)

RegisterKeyMapping('fdt', 'Open FiveM DevOps Toolkit overlay', 'keyboard', '')
