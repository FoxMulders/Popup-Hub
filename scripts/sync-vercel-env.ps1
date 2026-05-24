# sync-vercel-env.ps1
# Pushes environment variables from .env.local to Vercel (production + preview).
#
# Usage:
#   .\scripts\sync-vercel-env.ps1           # sync all production keys
#   .\scripts\sync-vercel-env.ps1 -DryRun   # list keys only, no writes
#
# Prerequisites:
#   - .env.local with real values
#   - Vercel CLI linked (npx vercel link) or .vercel/project.json present
#   - NEXT_PUBLIC_APP_URL should be https://popup-hub.vercel.app for production

param(
    [switch]$DryRun,
    [string]$ProductionAppUrl = 'https://popup-hub.vercel.app',
    [ValidateSet('production', 'preview', 'development', 'all')]
    [string[]]$Environments = @('production', 'preview')
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvFile = Join-Path $ProjectRoot '.env.local'

# Keys synced to Vercel (DEV_MOCK_* and empty values are skipped)
$SyncKeys = @(
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
    'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY',
    'NEXT_PUBLIC_SQUARE_APP_ID',
    'NEXT_PUBLIC_SQUARE_LOCATION_ID',
    'SQUARE_ACCESS_TOKEN',
    'SQUARE_WEBHOOK_SIGNATURE_KEY',
    'SQUARE_ENVIRONMENT',
    'SQUARE_CLIENT_ID',
    'SQUARE_CLIENT_SECRET',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PLATFORM_FEE_BPS',
    'PLATFORM_FEE_MODE',
    'PLATFORM_FEE_FLAT_CENTS',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'TWILIO_FROM_NUMBER',
    'CRON_SECRET'
)

$SkipPrefixes = @('DEV_MOCK_')

if (-not (Test-Path $EnvFile)) {
    Write-Host "ERROR: .env.local not found. Copy .env.local.example and fill in values." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==> Sync Vercel env from .env.local" -ForegroundColor Cyan
Write-Host "    Environments: $($Environments -join ', ')"
if ($DryRun) { Write-Host "    DRY RUN - no changes will be written" -ForegroundColor Yellow }
Write-Host ""

$parsed = @{}
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $value = $line.Substring($eq + 1).Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    $parsed[$key] = $value
}

$toSync = @()
foreach ($key in $SyncKeys) {
    if ($SkipPrefixes | Where-Object { $key.StartsWith($_) }) { continue }
    if (-not $parsed.ContainsKey($key)) { continue }
    $val = $parsed[$key]
    if ([string]::IsNullOrWhiteSpace($val)) { continue }
    if ($val -match '^(YOUR_|placeholder|changeme)') { continue }
    $toSync += @{ Key = $key; Value = $val }
}

if ($toSync.Count -eq 0) {
    Write-Host "No keys to sync (all empty or placeholder). Fill .env.local first." -ForegroundColor Yellow
    exit 0
}

foreach ($entry in $toSync) {
    Write-Host "  $($entry.Key)" -ForegroundColor Gray
}

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry run complete. $($toSync.Count) key(s) would be synced." -ForegroundColor Green
    exit 0
}

Push-Location $ProjectRoot
try {
    foreach ($entry in $toSync) {
        foreach ($envName in $Environments) {
            $value = $entry.Value
            if ($entry.Key -eq 'NEXT_PUBLIC_APP_URL' -and $envName -eq 'production') {
                $value = $ProductionAppUrl
            }
            Write-Host "Adding $($entry.Key) -> $envName..." -ForegroundColor Cyan
            $prevEap = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            if ($envName -eq 'preview') {
                $null = npx vercel env add $entry.Key $envName --value $value --yes --force 2>&1
            } else {
                $null = $value | npx vercel env add $entry.Key $envName --force 2>&1
            }
            $exit = $LASTEXITCODE
            $ErrorActionPreference = $prevEap
            if ($exit -ne 0) {
                Write-Host "  Failed: $($entry.Key) ($envName)" -ForegroundColor Red
                exit 1
            }
        }
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "==> Synced $($toSync.Count) key(s). Redeploy: npx vercel deploy --prod" -ForegroundColor Green
Write-Host ""
