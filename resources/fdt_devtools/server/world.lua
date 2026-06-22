local playerBlips = {}
local playerProps = {}
local playerDoors = {}

local function getBlips(source)
    playerBlips[source] = playerBlips[source] or {}
    return playerBlips[source]
end

local function getProps(source)
    playerProps[source] = playerProps[source] or {}
    return playerProps[source]
end

local function getDoors(source)
    playerDoors[source] = playerDoors[source] or {}
    return playerDoors[source]
end

local function pushWorldState(source)
    TriggerClientEvent('fdt:devtools:blipsUpdated', source, getBlips(source))
    TriggerClientEvent('fdt:devtools:propsUpdated', source, getProps(source))
    TriggerClientEvent('fdt:devtools:doorsUpdated', source, getDoors(source))
end

local function sanitizeCoords(input)
    if type(input) ~= 'table' then
        return nil
    end

    return {
        x = FDT.RoundNumber(tonumber(input.x) or 0.0, 2),
        y = FDT.RoundNumber(tonumber(input.y) or 0.0, 2),
        z = FDT.RoundNumber(tonumber(input.z) or 0.0, 2),
        w = input.w and FDT.RoundNumber(tonumber(input.w) or 0.0, 2) or nil,
    }
end

local function sanitizeBlip(input)
    if type(input) ~= 'table' then
        return nil, 'Invalid blip payload.'
    end

    local coords = sanitizeCoords(input.coords)
    if not coords then
        return nil, 'Blip requires coordinates.'
    end

    return {
        id = FDT.Slugify(input.id or input.label or 'blip'),
        label = tostring(input.label or input.id or 'Blip'),
        sprite = math.floor(tonumber(input.sprite) or 1),
        color = math.floor(tonumber(input.color) or 0),
        scale = FDT.RoundNumber(tonumber(input.scale) or 0.8, 2),
        coords = coords,
        shortRange = input.shortRange ~= false,
        metadata = {},
    }
end

local function sanitizeProp(input)
    if type(input) ~= 'table' then
        return nil, 'Invalid prop payload.'
    end

    local coords = sanitizeCoords(input.coords)
    if not coords then
        return nil, 'Prop requires coordinates.'
    end

    local model = tostring(input.model or Config.DefaultPropModel or 'prop_cs_box_clothes')
    if model == '' then
        return nil, 'Prop requires a model name.'
    end

    return {
        id = FDT.Slugify(input.id or input.label or 'prop'),
        label = tostring(input.label or input.id or 'Prop'),
        model = model,
        coords = coords,
        metadata = {},
    }
end

local function sanitizeDoor(input)
    if type(input) ~= 'table' then
        return nil, 'Invalid door payload.'
    end

    local coords = sanitizeCoords(input.coords)
    if not coords then
        return nil, 'Door requires coordinates.'
    end

    local door = {
        id = FDT.Slugify(input.id or input.label or 'door'),
        label = tostring(input.label or input.id or 'Door'),
        coords = coords,
        locked = input.locked ~= false,
        metadata = {},
    }

    if input.model and tostring(input.model) ~= '' then
        door.model = tostring(input.model)
    end

    if input.group and tostring(input.group) ~= '' then
        door.group = tostring(input.group)
    end

    return door
end

local function upsertItem(list, item)
    local replaced = false
    for index, existing in ipairs(list) do
        if existing.id == item.id then
            list[index] = item
            replaced = true
            break
        end
    end

    if not replaced then
        table.insert(list, item)
    end
end

local function deleteItem(list, itemId)
    for index = #list, 1, -1 do
        if list[index].id == itemId then
            table.remove(list, index)
        end
    end
end

RegisterNetEvent('fdt:devtools:requestWorld', function()
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    pushWorldState(source)
end)

RegisterNetEvent('fdt:devtools:createBlip', function(input)
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    local blip, err = sanitizeBlip(input)
    if not blip then
        TriggerClientEvent('fdt:devtools:worldExportResult', source, { ok = false, message = err })
        return
    end

    upsertItem(getBlips(source), blip)
    pushWorldState(source)
end)

RegisterNetEvent('fdt:devtools:deleteBlip', function(blipId)
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    deleteItem(getBlips(source), blipId)
    pushWorldState(source)
end)

RegisterNetEvent('fdt:devtools:createProp', function(input)
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    local prop, err = sanitizeProp(input)
    if not prop then
        TriggerClientEvent('fdt:devtools:worldExportResult', source, { ok = false, message = err })
        return
    end

    upsertItem(getProps(source), prop)
    pushWorldState(source)
end)

RegisterNetEvent('fdt:devtools:deleteProp', function(propId)
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    deleteItem(getProps(source), propId)
    pushWorldState(source)
end)

RegisterNetEvent('fdt:devtools:createDoor', function(input)
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    local door, err = sanitizeDoor(input)
    if not door then
        TriggerClientEvent('fdt:devtools:worldExportResult', source, { ok = false, message = err })
        return
    end

    upsertItem(getDoors(source), door)
    pushWorldState(source)
end)

RegisterNetEvent('fdt:devtools:deleteDoor', function(doorId)
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    deleteItem(getDoors(source), doorId)
    pushWorldState(source)
end)

RegisterNetEvent('fdt:devtools:exportWorld', function()
    local source = source
    if not FDT_CanUseDevtools(source) then
        TriggerClientEvent('fdt:devtools:worldExportResult', source, {
            ok = false,
            message = 'Permission denied.',
        })
        return
    end

    local blips = getBlips(source)
    local props = getProps(source)
    local doors = getDoors(source)

    if #blips == 0 and #props == 0 and #doors == 0 then
        TriggerClientEvent('fdt:devtools:worldExportResult', source, {
            ok = false,
            message = 'No blips, props, or doors to export.',
        })
        return
    end

    local result = FDT_ExportWorld(source, {
        blips = blips,
        props = props,
        doors = doors,
    })

    TriggerClientEvent('fdt:devtools:worldExportResult', source, result)
end)

AddEventHandler('playerDropped', function()
    playerBlips[source] = nil
    playerProps[source] = nil
    playerDoors[source] = nil
end)
