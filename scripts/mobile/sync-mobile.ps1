# Sync Capacitor native shells (iOS + Android) — assets + cap sync.
# Usage: .\scripts\mobile\sync-mobile.ps1 [-ServerUrl <url>]

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

    if (-not (Test-Path -LiteralPath 'android')) {
        Write-Host 'Adding Android platform (first run)...'
        npx cap add android
        if ($LASTEXITCODE -ne 0) { throw 'cap add android failed' }
    }

    if (-not (Test-Path -LiteralPath 'android/local.properties')) {
        $defaultSdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
        if (Test-Path -LiteralPath $defaultSdk) {
            $escaped = $defaultSdk -replace '\\', '\\'
            "sdk.dir=$escaped" | Set-Content -Path 'android/local.properties' -Encoding ASCII
            Write-Host "Wrote android/local.properties -> $defaultSdk"
        } else {
            Write-Host 'WARN: android/local.properties missing — copy android/local.properties.example'
        }
    }

    npx cap sync
    if ($LASTEXITCODE -ne 0) { throw 'cap sync failed' }

    Write-Host 'Capacitor sync complete (iOS + Android).'
    Write-Host 'iOS (Mac): npm run mobile:ios:open'
    Write-Host 'Android: npm run mobile:android:open'
}
finally {
    Pop-Location
}
