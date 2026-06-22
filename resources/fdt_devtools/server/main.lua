local playerZones = {}

local function getZones(source)
    playerZones[source] = playerZones[source] or {}
    return playerZones[source]
end

local function pushZones(source)
    TriggerClientEvent('fdt:devtools:zonesUpdated', source, getZones(source))
end

local function sanitizeZone(input)
    if type(input) ~= 'table' then
        return nil, 'Invalid zone payload.'
    end

    local id = FDT.Slugify(input.id or input.label or 'zone')
    local label = tostring(input.label or id)
    local zoneType = tostring(input.type or 'sphere')
    local purpose = tostring(input.purpose or 'custom')

    if zoneType ~= 'sphere' and zoneType ~= 'box' and zoneType ~= 'poly' then
        return nil, 'Unsupported zone type.'
    end

    local coords = input.coords
    if type(coords) ~= 'table' or coords[1] == nil then
        return nil, 'Zone requires at least one coordinate.'
    end

    local first = coords[1]
    local zone = {
        id = id,
        label = label,
        type = zoneType,
        purpose = purpose,
        coords = {
            {
                x = FDT.RoundNumber(tonumber(first.x) or 0.0, 2),
                y = FDT.RoundNumber(tonumber(first.y) or 0.0, 2),
                z = FDT.RoundNumber(tonumber(first.z) or 0.0, 2),
            },
        },
        metadata = {},
    }

    if input.heading then
        zone.heading = FDT.RoundNumber(tonumber(input.heading) or 0.0, 2)
    end

    if zoneType == 'sphere' then
        zone.radius = FDT.RoundNumber(tonumber(input.radius) or 2.0, 2)
    end

    if zoneType == 'box' then
        zone.width = FDT.RoundNumber(tonumber(input.width) or 4.0, 2)
        zone.length = FDT.RoundNumber(tonumber(input.length) or 4.0, 2)
    end

    return zone
end

RegisterNetEvent('fdt:devtools:requestOpen', function()
    local source = source
    if not FDT_CanUseDevtools(source) then
        TriggerClientEvent('fdt:devtools:openDenied', source)
        return
    end

    TriggerClientEvent('fdt:devtools:openAllowed', source)
end)

RegisterNetEvent('fdt:devtools:requestZones', function()
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    pushZones(source)
end)

RegisterNetEvent('fdt:devtools:createZone', function(input)
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    local zone, err = sanitizeZone(input)
    if not zone then
        TriggerClientEvent('fdt:devtools:exportResult', source, {
            ok = false,
            message = err,
        })
        return
    end

    local zones = getZones(source)
    local replaced = false

    for index, existing in ipairs(zones) do
        if existing.id == zone.id then
            zones[index] = zone
            replaced = true
            break
        end
    end

    if not replaced then
        table.insert(zones, zone)
    end

    pushZones(source)
end)

RegisterNetEvent('fdt:devtools:deleteZone', function(zoneId)
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    local zones = getZones(source)
    for index = #zones, 1, -1 do
        if zones[index].id == zoneId then
            table.remove(zones, index)
        end
    end

    pushZones(source)
end)

RegisterNetEvent('fdt:devtools:exportZones', function()
    local source = source
    if not FDT_CanUseDevtools(source) then
        TriggerClientEvent('fdt:devtools:exportResult', source, {
            ok = false,
            message = 'Permission denied.',
        })
        return
    end

    local result = FDT_ExportZones(source, getZones(source))
    TriggerClientEvent('fdt:devtools:exportResult', source, result)
end)

AddEventHandler('playerDropped', function()
    playerZones[source] = nil
end)

print('[fdt_devtools] FiveM DevOps Toolkit dev overlay loaded.')
