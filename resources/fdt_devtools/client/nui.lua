local nuiOpen = false
local hasPermission = false

function FDT.IsNuiOpen()
    return nuiOpen
end

function FDT.SetNuiOpen(state)
    nuiOpen = state
    SetNuiFocus(state, state)
    SetNuiFocusKeepInput(false)
end

function FDT.SetHasPermission(state)
    hasPermission = state
end

function FDT.HasPermission()
    return hasPermission
end

RegisterNUICallback('close', function(_, cb)
    FDT.SetNuiOpen(false)
    cb({ ok = true })
end)

RegisterNUICallback('copyText', function(_, cb)
    cb({ ok = true })
end)

RegisterNUICallback('createZone', function(data, cb)
    TriggerServerEvent('fdt:devtools:createZone', data)
    cb({ ok = true })
end)

RegisterNUICallback('deleteZone', function(data, cb)
    TriggerServerEvent('fdt:devtools:deleteZone', data.id)
    cb({ ok = true })
end)

RegisterNUICallback('requestZones', function(_, cb)
    TriggerServerEvent('fdt:devtools:requestZones')
    cb({ ok = true })
end)

RegisterNUICallback('exportZones', function(_, cb)
    TriggerServerEvent('fdt:devtools:exportZones')
    cb({ ok = true })
end)

RegisterNUICallback('requestWorld', function(_, cb)
    TriggerServerEvent('fdt:devtools:requestWorld')
    cb({ ok = true })
end)

RegisterNUICallback('createBlip', function(data, cb)
    TriggerServerEvent('fdt:devtools:createBlip', data)
    cb({ ok = true })
end)

RegisterNUICallback('deleteBlip', function(data, cb)
    TriggerServerEvent('fdt:devtools:deleteBlip', data.id)
    cb({ ok = true })
end)

RegisterNUICallback('createProp', function(data, cb)
    TriggerServerEvent('fdt:devtools:createProp', data)
    cb({ ok = true })
end)

RegisterNUICallback('deleteProp', function(data, cb)
    TriggerServerEvent('fdt:devtools:deleteProp', data.id)
    cb({ ok = true })
end)

RegisterNUICallback('createDoor', function(data, cb)
    TriggerServerEvent('fdt:devtools:createDoor', data)
    cb({ ok = true })
end)

RegisterNUICallback('deleteDoor', function(data, cb)
    TriggerServerEvent('fdt:devtools:deleteDoor', data.id)
    cb({ ok = true })
end)

RegisterNUICallback('exportWorld', function(_, cb)
    TriggerServerEvent('fdt:devtools:exportWorld')
    cb({ ok = true })
end)

RegisterNetEvent('fdt:devtools:worldExportResult', function(result)
    SendNUIMessage({
        type = 'worldExportResult',
        result = result,
    })
end)

RegisterNetEvent('fdt:devtools:zonesUpdated', function(zones)
    SendNUIMessage({
        type = 'zones',
        zones = zones,
    })
end)

RegisterNetEvent('fdt:devtools:exportResult', function(result)
    SendNUIMessage({
        type = 'exportResult',
        result = result,
    })
end)

RegisterNetEvent('fdt:devtools:openAllowed', function()
    FDT.SetHasPermission(true)
    FDT.SetNuiOpen(true)
    SendNUIMessage({ type = 'visible', visible = true })
    SendNUIMessage({ type = 'openTab', tab = FDT.PendingTab or 'zones' })
    FDT.PendingTab = nil
    TriggerServerEvent('fdt:devtools:requestZones')
    TriggerServerEvent('fdt:devtools:requestWorld')
end)

RegisterNetEvent('fdt:devtools:openDenied', function()
    FDT.SetHasPermission(false)
    TriggerEvent('chat:addMessage', {
        color = { 255, 80, 80 },
        multiline = false,
        args = { 'FDT', 'You do not have permission to use devtools.' },
    })
end)
