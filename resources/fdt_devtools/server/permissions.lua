function FDT_GetPrimaryIdentifier(source)
    local identifiers = GetPlayerIdentifiers(source)
    for _, identifier in ipairs(identifiers) do
        if string.sub(identifier, 1, 8) == 'license:' then
            return identifier
        end
    end
    return identifiers[1]
end

function FDT_IsAllowlisted(source)
    if not Config.IdentifierAllowlist or #Config.IdentifierAllowlist == 0 then
        return false
    end

    local identifiers = GetPlayerIdentifiers(source)
    for _, allowed in ipairs(Config.IdentifierAllowlist) do
        for _, identifier in ipairs(identifiers) do
            if identifier == allowed then
                return true
            end
        end
    end

    return false
end

function FDT_CanUseDevtools(source)
    if not Config.Enabled then
        return false
    end

    if Config.RequireAce and IsPlayerAceAllowed(source, Config.AcePermission) then
        return true
    end

    if FDT_IsAllowlisted(source) then
        return true
    end

    if not Config.RequireAce and IsPlayerAceAllowed(source, Config.AcePermission) then
        return true
    end

    return false
end
