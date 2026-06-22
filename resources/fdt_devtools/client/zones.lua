local sessionMarkers = {}

RegisterNetEvent('fdt:devtools:zonesUpdated', function(zones)
    sessionMarkers = zones or {}
end)

CreateThread(function()
    while true do
        if Config.DrawZoneMarkers and FDT.IsNuiOpen() then
            for _, zone in ipairs(sessionMarkers) do
                local coord = zone.coords and zone.coords[1]
                if coord then
                    if zone.type == 'sphere' and zone.radius then
                        DrawMarker(
                            28,
                            coord.x,
                            coord.y,
                            coord.z,
                            0.0,
                            0.0,
                            0.0,
                            0.0,
                            0.0,
                            0.0,
                            zone.radius * 2.0,
                            zone.radius * 2.0,
                            zone.radius * 2.0,
                            0,
                            180,
                            255,
                            80,
                            false,
                            false,
                            2,
                            false,
                            nil,
                            nil,
                            false
                        )
                    else
                        DrawMarker(
                            1,
                            coord.x,
                            coord.y,
                            coord.z - 1.0,
                            0.0,
                            0.0,
                            0.0,
                            0.0,
                            0.0,
                            0.0,
                            (zone.width or 2.0) * 1.0,
                            (zone.length or 2.0) * 1.0,
                            1.0,
                            0,
                            180,
                            255,
                            120,
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
            end
            Wait(0)
        else
            Wait(500)
        end
    end
end)
