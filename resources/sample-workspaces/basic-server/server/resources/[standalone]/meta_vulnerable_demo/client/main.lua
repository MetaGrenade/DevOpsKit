RegisterCommand('meta_free_money', function()
    TriggerServerEvent('meta:giveCash', 5000)
end, false)

TriggerServerEvent('meta:giveCash', 1000)
