local propEntities = {}

local function deletePropEntity(propId)
    local entity = propEntities[propId]
    if entity and DoesEntityExist(entity) then
        DeleteEntity(entity)
    end
    propEntities[propId] = nil
end

local function clearPropEntities()
    for propId in pairs(propEntities) do
        deletePropEntity(propId)
    end
end

local function spawnPropPreview(prop)
    deletePropEntity(prop.id)

    if not Config.DrawWorldMarkers then
        return
    end

    local modelName = prop.model
    local modelHash = joaat(modelName)
    if not IsModelInCdimage(modelHash) then
        return
    end

    RequestModel(modelHash)
    local timeout = GetGameTimer() + 5000
    while not HasModelLoaded(modelHash) and GetGameTimer() < timeout do
        Wait(0)
    end

    if not HasModelLoaded(modelHash) then
        return
    end

    local coord = prop.coords
    local entity = CreateObject(
        modelHash,
        coord.x,
        coord.y,
        coord.z,
        false,
        false,
        false
    )

    if entity and entity ~= 0 then
        SetEntityHeading(entity, coord.w or 0.0)
        FreezeEntityPosition(entity, true)
        SetEntityAsMissionEntity(entity, true, true)
        propEntities[prop.id] = entity
    end

    SetModelAsNoLongerNeeded(modelHash)
end

local function refreshPropPreview(props)
    local seen = {}

    for _, prop in ipairs(props or {}) do
        seen[prop.id] = true
        spawnPropPreview(prop)
    end

    for propId in pairs(propEntities) do
        if not seen[propId] then
            deletePropEntity(propId)
        end
    end
end

RegisterNetEvent('fdt:devtools:propsUpdated', function(props)
    refreshPropPreview(props)
    SendNUIMessage({
        type = 'props',
        props = props,
    })
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then
        return
    end
    clearPropEntities()
end)
