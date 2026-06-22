local stateBagOpen = false
local targetMode = 'player'
local activeEntity = nil
local entryCache = {}
local watchedKeys = {}

FDT.StateBagTargetMode = 'player'
FDT.StateBagActiveEntity = nil

function FDT.IsStateBagOpen()
    return stateBagOpen
end

function FDT.SetStateBagOpen(state)
    stateBagOpen = state
    SetNuiFocus(state, state)
    SetNuiFocusKeepInput(false)
end

local function encodeValue(value)
    local valueType = type(value)
    if valueType == 'string' or valueType == 'boolean' or valueType == 'number' then
        return value
    end

    if valueType == 'table' then
        local ok, encoded = pcall(json.encode, value)
        if ok then
            return json.decode(encoded)
        end
        return '[table]'
    end

    return tostring(value)
end

local function playerBagName()
    return ('player:%s'):format(GetPlayerServerId(PlayerId()))
end

local function entityBagName(entity)
    if not entity or entity == 0 or not NetworkGetEntityIsNetworked(entity) then
        return nil
    end

    local netId = NetworkGetNetworkIdFromEntity(entity)
    if not netId or netId == 0 then
        return nil
    end

    return ('entity:%s'):format(netId)
end

local function modelName(entity)
    if not entity or entity == 0 then
        return nil
    end

    local model = GetEntityModel(entity)
    return model and tostring(model) or nil
end

local function rotationToDirection(rotation)
    local adjusted = {
        x = (math.pi / 180.0) * rotation.x,
        y = (math.pi / 180.0) * rotation.y,
        z = (math.pi / 180.0) * rotation.z,
    }

    return {
        x = -math.sin(adjusted.z) * math.abs(math.cos(adjusted.x)),
        y = math.cos(adjusted.z) * math.abs(math.cos(adjusted.x)),
        z = math.sin(adjusted.x),
    }
end

local function raycastTargetEntity(maxDistance)
    local ped = PlayerPedId()
    local cameraRotation = GetGameplayCamRot(2)
    local cameraCoord = GetGameplayCamCoord()
    local direction = rotationToDirection(cameraRotation)
    local destination = {
        x = cameraCoord.x + direction.x * maxDistance,
        y = cameraCoord.y + direction.y * maxDistance,
        z = cameraCoord.z + direction.z * maxDistance,
    }

    local _, hit, _, _, entityHit = GetShapeTestResult(
        StartShapeTestRay(
            cameraCoord.x,
            cameraCoord.y,
            cameraCoord.z,
            destination.x,
            destination.y,
            destination.z,
            -1,
            ped,
            0
        )
    )

    if hit == 1 and entityHit and entityHit ~= 0 then
        return entityHit
    end

    return nil
end

local function resolveTargetEntity()
    local ped = PlayerPedId()

    if targetMode == 'vehicle' then
        local vehicle = GetVehiclePedIsIn(ped, false)
        if vehicle ~= 0 then
            return vehicle, 'vehicle'
        end
    end

    if targetMode == 'crosshair' then
        local entityHit = raycastTargetEntity(Config.StateBagRaycastDistance or 12.0)
        if entityHit then
            if IsEntityAVehicle(entityHit) then
                return entityHit, 'vehicle'
            end
            return entityHit, 'entity'
        end
    end

    return ped, 'player'
end

local function readStateValue(entity, bagName, key)
    if bagName == playerBagName() then
        return LocalPlayer.state[key]
    end

    if entity and entity ~= 0 then
        return Entity(entity).state[key]
    end

    return nil
end

local function touchEntry(bagName, key, value, replicated)
    entryCache[bagName] = entryCache[bagName] or {}
    local existing = entryCache[bagName][key] or { updateCount = 0 }
    existing.value = encodeValue(value)
    existing.lastUpdatedMs = GetGameTimer()
    existing.updateCount = (existing.updateCount or 0) + 1
    existing.replicated = replicated
    entryCache[bagName][key] = existing
end

local function collectEntries(entity, bagName)
    local keys = {}
    local seen = {}

    for _, key in ipairs(Config.StateBagWatchKeys or {}) do
        keys[#keys + 1] = key
        seen[key] = true
    end

    for key in pairs(watchedKeys) do
        if not seen[key] then
            keys[#keys + 1] = key
            seen[key] = true
        end
    end

    if entryCache[bagName] then
        for key in pairs(entryCache[bagName]) do
            if not seen[key] then
                keys[#keys + 1] = key
                seen[key] = true
            end
        end
    end

    table.sort(keys)

    local entries = {}
    local now = GetGameTimer()

    for _, key in ipairs(keys) do
        local cached = entryCache[bagName] and entryCache[bagName][key] or nil
        local value = readStateValue(entity, bagName, key)

        if value ~= nil then
            touchEntry(bagName, key, value, cached and cached.replicated or true)
            cached = entryCache[bagName][key]
        end

        if cached then
            entries[#entries + 1] = {
                key = key,
                value = cached.value,
                replicated = cached.replicated,
                lastUpdatedMs = cached.lastUpdatedMs,
                updateCount = cached.updateCount,
                stale = (now - (cached.lastUpdatedMs or now)) > (Config.StateBagStaleMs or 15000),
            }
        else
            entries[#entries + 1] = {
                key = key,
                value = nil,
                stale = true,
            }
        end
    end

    return entries
end

local function buildSnapshot()
    local entity, kind = resolveTargetEntity()
    activeEntity = entity
    FDT.StateBagActiveEntity = entity

    local bagName = kind == 'player' and playerBagName() or entityBagName(entity)
    if not bagName then
        bagName = playerBagName()
        kind = 'player'
        entity = PlayerPedId()
    end

    local networkId = NetworkGetEntityIsNetworked(entity) and NetworkGetNetworkIdFromEntity(entity) or nil

    return {
        schemaVersion = 1,
        exportedAt = tostring(GetGameTimer()),
        target = {
            kind = kind,
            bagName = bagName,
            entityId = entity,
            networkId = networkId,
            model = modelName(entity),
        },
        entries = collectEntries(entity, bagName),
        watchedKeys = watchedKeys,
    }
end

local function pushSnapshot()
    SendNUIMessage({
        type = 'stateBagSnapshot',
        snapshot = buildSnapshot(),
        targetMode = targetMode,
    })
end

AddStateBagChangeHandler(nil, nil, function(bagName, key, value, _, replicated)
    if not stateBagOpen then
        return
    end

    watchedKeys[key] = true
    touchEntry(bagName, key, value, replicated)

    local entity, _ = resolveTargetEntity()
    local activeBag = entityBagName(entity) or playerBagName()
    if bagName == activeBag or bagName == playerBagName() then
        pushSnapshot()
    end
end)

CreateThread(function()
    while true do
        if stateBagOpen then
            pushSnapshot()
            Wait(500)
        else
            Wait(750)
        end
    end
end)

RegisterNetEvent('fdt:statebag:openAllowed', function()
    FDT.SetStateBagOpen(true)
    SendNUIMessage({ type = 'stateBagVisible', visible = true })
    pushSnapshot()
end)

RegisterNetEvent('fdt:statebag:openDenied', function()
    TriggerEvent('chat:addMessage', {
        color = { 255, 80, 80 },
        args = { 'FDT', 'You do not have permission to use state bag tools.' },
    })
end)

RegisterNetEvent('fdt:statebag:exportResult', function(result)
    SendNUIMessage({
        type = 'stateBagExportResult',
        result = result,
    })
end)

RegisterNUICallback('stateBagClose', function(_, cb)
    FDT.SetStateBagOpen(false)
    SendNUIMessage({ type = 'stateBagVisible', visible = false })
    cb({ ok = true })
end)

RegisterNUICallback('stateBagSetTarget', function(data, cb)
    if data.mode == 'player' or data.mode == 'vehicle' or data.mode == 'crosshair' then
        targetMode = data.mode
        FDT.StateBagTargetMode = targetMode
    end
    pushSnapshot()
    cb({ ok = true })
end)

RegisterNUICallback('stateBagWatchKey', function(data, cb)
    if type(data.key) == 'string' and data.key ~= '' then
        watchedKeys[data.key] = true
    end
    pushSnapshot()
    cb({ ok = true })
end)

RegisterNUICallback('stateBagExport', function(_, cb)
    TriggerServerEvent('fdt:statebag:export', buildSnapshot())
    cb({ ok = true })
end)

RegisterCommand('fdt_state', function()
    if FDT.IsStateBagOpen() then
        FDT.SetStateBagOpen(false)
        SendNUIMessage({ type = 'stateBagVisible', visible = false })
        return
    end

    if not Config.Enabled then
        return
    end

    TriggerServerEvent('fdt:statebag:requestOpen')
end, false)
