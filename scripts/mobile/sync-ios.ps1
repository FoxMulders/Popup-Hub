# Sync Capacitor iOS shell — assets + cap sync.
# Usage: .\scripts\mobile\sync-ios.ps1 [-ServerUrl <url>]

param(
    [string]$ServerUrl = ''
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $ProjectRoot
try {
    if ($ServerUrl) {
        $env:CAPACITOR_SERVER_URL = $ServerUrl
        Write-Host "CAPACITOR_SERVER_URL=$ServerUrl"
    }

    node scripts/mobile/generate-ios-resources.mjs
    if ($LASTEXITCODE -ne 0) { throw 'generate-ios-resources.mjs failed' }

    if (-not (Test-Path -LiteralPath 'ios')) {
        Write-Host 'Adding iOS platform (first run)...'
        npx cap add ios
        if ($LASTEXITCODE -ne 0) { throw 'cap add ios failed' }
        node scripts/mobile/generate-ios-resources.mjs
        if ($LASTEXITCODE -ne 0) { throw 'generate-ios-resources.mjs failed after cap add ios' }
    }

    npx cap sync ios
    if ($LASTEXITCODE -ne 0) { throw 'cap sync ios failed' }

    node scripts/mobile/patch-ios-widget.mjs
    if ($LASTEXITCODE -ne 0) { throw 'patch-ios-widget.mjs failed' }

    Write-Host 'Capacitor iOS sync complete.'
    Write-Host 'On macOS: npm run mobile:ios:open'
}
finally {
    Pop-Location
}
