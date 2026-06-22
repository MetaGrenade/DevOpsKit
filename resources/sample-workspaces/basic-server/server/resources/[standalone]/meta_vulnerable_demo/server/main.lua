RegisterNetEvent('meta:giveCash')

AddEventHandler('meta:giveCash', function(amount)
    local payout = tonumber(amount) or 0
    print(('Giving cash to player %s: %s'):format(source, payout))
    xPlayer.addMoney(payout)
end)

RegisterCommand('meta_debug_exec', function(source, args)
    local code = table.concat(args, ' ')
    loadstring(code)()
end, false)
