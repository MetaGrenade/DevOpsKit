FDT = FDT or {}

function FDT.Slugify(value)
    if type(value) ~= 'string' then
        return 'zone'
    end

    local slug = string.lower(value)
    slug = slug:gsub('%s+', '_')
    slug = slug:gsub('[^a-z0-9_]', '')
    if slug == '' then
        slug = 'zone'
    end
    return slug
end

function FDT.RoundNumber(value, places)
    local mult = 10 ^ (places or 2)
    return math.floor((value * mult) + 0.5) / mult
end

function FDT.Vector3String(coords)
    return string.format(
        'vector3(%.2f, %.2f, %.2f)',
        FDT.RoundNumber(coords.x, 2),
        FDT.RoundNumber(coords.y, 2),
        FDT.RoundNumber(coords.z, 2)
    )
end

function FDT.Vector4String(coords, heading)
    return string.format(
        'vector4(%.2f, %.2f, %.2f, %.2f)',
        FDT.RoundNumber(coords.x, 2),
        FDT.RoundNumber(coords.y, 2),
        FDT.RoundNumber(coords.z, 2),
        FDT.RoundNumber(heading or 0.0, 2)
    )
end

function FDT.GetPlayerCoords()
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    return {
        x = FDT.RoundNumber(coords.x, 2),
        y = FDT.RoundNumber(coords.y, 2),
        z = FDT.RoundNumber(coords.z, 2),
    }, FDT.RoundNumber(GetEntityHeading(ped), 2)
end
