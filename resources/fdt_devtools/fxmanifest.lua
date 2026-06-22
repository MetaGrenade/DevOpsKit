fx_version 'cerulean'
game 'gta5'

name 'fdt_devtools'
author 'FiveM DevOps Toolkit'
description 'Permission-protected in-game dev overlay for coordinates and zone export'
version '0.1.0'

lua54 'yes'

shared_scripts {
    'config.lua',
    'shared/utils.lua',
}

client_scripts {
    'client/nui.lua',
    'client/zones.lua',
    'client/blips.lua',
    'client/props.lua',
    'client/doors.lua',
    'client/qa.lua',
    'client/statebag.lua',
    'client/main.lua',
}

server_scripts {
    'server/permissions.lua',
    'server/export.lua',
    'server/world.lua',
    'server/qa.lua',
    'server/statebag.lua',
    'server/main.lua',
}

ui_page 'web/dist/index.html'

files {
    'web/dist/index.html',
    'web/dist/assets/*',
    'data/qa-scenarios.json',
}
