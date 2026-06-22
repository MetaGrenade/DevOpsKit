local qaOpen = false

function FDT.IsQaOpen()
    return qaOpen
end

function FDT.SetQaOpen(state)
    qaOpen = state
    SetNuiFocus(state, state)
    SetNuiFocusKeepInput(false)
end

RegisterNetEvent('fdt:qa:scenariosUpdated', function(scenarios)
    SendNUIMessage({ type = 'qaScenarios', scenarios = scenarios })
end)

RegisterNetEvent('fdt:qa:runUpdated', function(result)
    SendNUIMessage({ type = 'qaRunUpdated', result = result })
end)

RegisterNetEvent('fdt:qa:exportResult', function(result)
    SendNUIMessage({ type = 'qaExportResult', result = result })
end)

RegisterNetEvent('fdt:qa:openAllowed', function()
    FDT.SetQaOpen(true)
    SendNUIMessage({ type = 'qaVisible', visible = true })
    TriggerServerEvent('fdt:qa:requestScenarios')
end)

RegisterNetEvent('fdt:qa:openDenied', function()
    TriggerEvent('chat:addMessage', {
        color = { 255, 80, 80 },
        args = { 'FDT', 'You do not have permission to use QA tools.' },
    })
end)

RegisterNUICallback('qaClose', function(_, cb)
    FDT.SetQaOpen(false)
    SendNUIMessage({ type = 'qaVisible', visible = false })
    cb({ ok = true })
end)

RegisterNUICallback('qaStartRun', function(data, cb)
    TriggerServerEvent('fdt:qa:startRun', data.scenarioId)
    cb({ ok = true })
end)

RegisterNUICallback('qaUpdateStep', function(data, cb)
    TriggerServerEvent('fdt:qa:updateStep', data.stepId, data.status, data.note)
    cb({ ok = true })
end)

RegisterNUICallback('qaExportRun', function(_, cb)
    TriggerServerEvent('fdt:qa:exportRun')
    cb({ ok = true })
end)

RegisterNUICallback('qaTeleportStep', function(data, cb)
    local coords = data.coords
    if coords and coords.x and coords.y and coords.z then
        local ped = PlayerPedId()
        SetEntityCoords(ped, coords.x + 0.0, coords.y + 0.0, coords.z + 0.0, false, false, false, false)
        if coords.heading then
            SetEntityHeading(ped, coords.heading + 0.0)
        end
    end
    cb({ ok = true })
end)

RegisterCommand('fdt_qatest', function()
    if FDT.IsQaOpen() then
        FDT.SetQaOpen(false)
        SendNUIMessage({ type = 'qaVisible', visible = false })
        return
    end

    if not Config.Enabled then
        return
    end

    TriggerServerEvent('fdt:qa:requestOpen')
end, false)
