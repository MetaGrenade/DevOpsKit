-- QA scenario runner (server)

local playerRuns = {}

local function loadScenarios()
    local raw = LoadResourceFile(GetCurrentResourceName(), 'data/qa-scenarios.json')
    if not raw then
        return { schemaVersion = 1, scenarios = {} }
    end

    local ok, parsed = pcall(json.decode, raw)
    if not ok or type(parsed) ~= 'table' then
        return { schemaVersion = 1, scenarios = {} }
    end

    return parsed
end

local function findScenario(scenarioId)
    local registry = loadScenarios()
    for _, scenario in ipairs(registry.scenarios or {}) do
        if scenario.id == scenarioId then
            return scenario
        end
    end
    return nil
end

local function buildRunExport(source, run)
    return {
        schemaVersion = 1,
        exportedAt = os.date('!%Y-%m-%dT%H:%M:%SZ'),
        exportedBy = FDT_GetPrimaryIdentifier(source),
        resource = 'fdt_devtools',
        run = run,
    }
end

RegisterNetEvent('fdt:qa:requestOpen', function()
    local source = source
    if not FDT_CanUseDevtools(source) then
        TriggerClientEvent('fdt:qa:openDenied', source)
        return
    end

    TriggerClientEvent('fdt:qa:openAllowed', source)
end)

RegisterNetEvent('fdt:qa:requestScenarios', function()
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    TriggerClientEvent('fdt:qa:scenariosUpdated', source, loadScenarios().scenarios or {})
end)

RegisterNetEvent('fdt:qa:startRun', function(scenarioId)
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    local scenario = findScenario(scenarioId)
    if not scenario then
        TriggerClientEvent('fdt:qa:runUpdated', source, {
            ok = false,
            message = 'Scenario not found.',
        })
        return
    end

    local startedAt = os.date('!%Y-%m-%dT%H:%M:%SZ')
    local runId = ('qa_%s_%s'):format(source, os.time())
    local stepResults = {}

    for _, step in ipairs(scenario.steps or {}) do
        table.insert(stepResults, {
            stepId = step.id,
            status = 'pending',
            updatedAt = startedAt,
        })
    end

    local run = {
        id = runId,
        scenarioId = scenario.id,
        scenarioLabel = scenario.label,
        status = 'in_progress',
        startedAt = startedAt,
        tester = FDT_GetPrimaryIdentifier(source),
        stepResults = stepResults,
    }

    playerRuns[source] = run
    TriggerClientEvent('fdt:qa:runUpdated', source, { ok = true, run = run, scenario = scenario })
end)

RegisterNetEvent('fdt:qa:updateStep', function(stepId, status, note)
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    local run = playerRuns[source]
    if not run then
        return
    end

    for _, result in ipairs(run.stepResults) do
        if result.stepId == stepId then
            result.status = status
            result.note = note
            result.updatedAt = os.date('!%Y-%m-%dT%H:%M:%SZ')
        end
    end

    local hasFailure = false
    local allDone = #run.stepResults > 0

    for _, result in ipairs(run.stepResults) do
        if result.status == 'failed' then
            hasFailure = true
        end
        if result.status == 'pending' then
            allDone = false
        end
    end

    if hasFailure then
        run.status = 'failed'
        run.completedAt = os.date('!%Y-%m-%dT%H:%M:%SZ')
    elseif allDone then
        run.status = 'completed'
        run.completedAt = os.date('!%Y-%m-%dT%H:%M:%SZ')
    else
        run.status = 'in_progress'
    end

    TriggerClientEvent('fdt:qa:runUpdated', source, { ok = true, run = run })
end)

RegisterNetEvent('fdt:qa:exportRun', function()
    local source = source
    if not FDT_CanUseDevtools(source) then
        return
    end

    local run = playerRuns[source]
    if not run then
        TriggerClientEvent('fdt:qa:exportResult', source, { ok = false, message = 'No active QA run.' })
        return
    end

    local payload = buildRunExport(source, run)

    if Config.PostQaRunToDashboard and Config.DashboardQaImportUrl and Config.DashboardQaImportUrl ~= '' then
        PerformHttpRequest(
            Config.DashboardQaImportUrl,
            function(statusCode, _, _)
                print(('[fdt_devtools] QA run import HTTP %s'):format(tostring(statusCode)))
            end,
            'POST',
            json.encode(payload),
            { ['Content-Type'] = 'application/json' }
        )
    end

    TriggerClientEvent('fdt:qa:exportResult', source, {
        ok = true,
        message = 'QA run exported.',
        payload = payload,
    })
end)

AddEventHandler('playerDropped', function()
    playerRuns[source] = nil
end)
