local sessionDoors = {}

RegisterNetEvent('fdt:devtools:doorsUpdated', function(doors)
    sessionDoors = doors or {}
    SendNUIMessage({
        type = 'doors',
        doors = sessionDoors,
    })
end)

CreateThread(function()
    while true do
        if Config.DrawWorldMarkers and FDT.IsNuiOpen() then
            for _, door in ipairs(sessionDoors) do
                local coord = door.coords
                if coord then
                    DrawMarker(
                        27,
                        coord.x,
                        coord.y,
                        coord.z - 0.95,
                        0.0,
                        0.0,
                        0.0,
                        0.0,
                        0.0,
                        coord.w or 0.0,
                        0.35,
                        0.35,
                        0.35,
                        255,
                        180,
                        80,
                        180,
                        false,
                        false,
                        2,
                        false,
                        nil,
                        nil,
                        false
                    )
                end
            end
            Wait(0)
        else
            Wait(500)
        end
    end
end)
