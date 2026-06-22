local blipHandles = {}

local function clearBlipHandles()
    for _, handle in pairs(blipHandles) do
        if DoesBlipExist(handle) then
            RemoveBlip(handle)
        end
    end
    blipHandles = {}
end

local function refreshBlipPreview(blips)
    clearBlipHandles()

    if not Config.DrawWorldMarkers then
        return
    end

    for _, blip in ipairs(blips or {}) do
        local coord = blip.coords
        if coord then
            local handle = AddBlipForCoord(coord.x, coord.y, coord.z)
            SetBlipSprite(handle, blip.sprite or 1)
            SetBlipColour(handle, blip.color or 0)
            SetBlipScale(handle, blip.scale or 0.8)
            SetBlipAsShortRange(handle, blip.shortRange ~= false)
            BeginTextCommandSetBlipName('STRING')
            AddTextComponentString(blip.label or blip.id or 'FDT Blip')
            EndTextCommandSetBlipName(handle)
            blipHandles[blip.id] = handle
        end
    end
end

RegisterNetEvent('fdt:devtools:blipsUpdated', function(blips)
    refreshBlipPreview(blips)
    SendNUIMessage({
        type = 'blips',
        blips = blips,
    })
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end
    clearBlipHandles()
end)
