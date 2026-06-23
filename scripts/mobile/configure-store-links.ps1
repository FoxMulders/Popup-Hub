# Patch universal-link files with your Apple Team ID and Android signing fingerprint.
# Usage:
#   .\scripts\mobile\configure-store-links.ps1 -AppleTeamId AB12CD34EF
#   .\scripts\mobile\configure-store-links.ps1 -AndroidSha256 "AA:BB:CC:..."
# Or set env vars APPLE_TEAM_ID / ANDROID_SHA256_FINGERPRINT and run with no args.

param(
    [string]$AppleTeamId = $env:APPLE_TEAM_ID,
    [string]$AndroidSha256 = $env:ANDROID_SHA256_FINGERPRINT
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Push-Location $ProjectRoot
try {
    $aasaPath = Join-Path $ProjectRoot 'public\.well-known\apple-app-site-association'
    $assetLinksPath = Join-Path $ProjectRoot 'public\.well-known\assetlinks.json'

    if ($AppleTeamId) {
        $aasa = Get-Content -LiteralPath $aasaPath -Raw
        $aasa = $aasa -replace 'TEAM_ID', $AppleTeamId.Trim()
        Set-Content -LiteralPath $aasaPath -Value $aasa -NoNewline
        Write-Host "Updated apple-app-site-association with Team ID $AppleTeamId"
    } else {
        Write-Host 'Skip AASA — pass -AppleTeamId or set APPLE_TEAM_ID'
    }

    if ($AndroidSha256) {
        $fingerprint = ($AndroidSha256.Trim() -replace ':', '').ToUpperInvariant()
        $formatted = ($fingerprint -split '(?<=\G.{2})' | Where-Object { $_ }) -join ':'
        $assetLinks = Get-Content -LiteralPath $assetLinksPath -Raw
        $assetLinks = $assetLinks -replace 'REPLACE_WITH_YOUR_RELEASE_KEY_SHA256', $formatted
        Set-Content -LiteralPath $assetLinksPath -Value $assetLinks -NoNewline
        Write-Host "Updated assetlinks.json with SHA-256 $formatted"
    } else {
        Write-Host 'Skip assetlinks — pass -AndroidSha256 or set ANDROID_SHA256_FINGERPRINT'
        Write-Host 'Debug keystore fingerprint (internal testing only):'
        Write-Host '  keytool -list -v -keystore $env:USERPROFILE\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android'
    }

    Write-Host ''
    Write-Host 'Next: deploy web so https://popuphub.ca/.well-known/* serves the updated files.'
    Write-Host 'iOS: enable Associated Domains in Xcode (applinks:popuphub.ca) — already in App.entitlements.'
}
finally {
    Pop-Location
}
