# launch-qa.ps1
# Pre-ship automated regression - run before npm run ship

param(
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Run-Step($label, $command) {
    Write-Host ""
    Write-Host "==> $label" -ForegroundColor Cyan
    Invoke-Expression $command
    if ($LASTEXITCODE -ne 0) {
        throw "$label failed (exit $LASTEXITCODE)"
    }
}

Write-Host ""
Write-Host "Popup Hub - Launch MVP automated QA" -ForegroundColor White
Write-Host "===================================" -ForegroundColor DarkGray

try {
    Run-Step "TypeScript" "npx tsc --noEmit"
    Run-Step "Layout math" "npm run qa:layout"
    Run-Step "Shopper routing (synthetic)" "npm run test:shopper-routing"
    Run-Step "Shopper routing (live layout)" "npm run test:shopper-routing:live"

    if (-not $SkipBuild) {
        Run-Step "Production build" "npm run build"
    }

    Write-Host ""
    Write-Host "==> All launch QA checks passed." -ForegroundColor Green
    Write-Host "    Manual checklist: docs/COORDINATOR_QA.md" -ForegroundColor DarkGray
    Write-Host "    Production smoke: npm run verify:prod" -ForegroundColor DarkGray
    exit 0
}
catch {
    Write-Host ""
    Write-Host "==> Launch QA failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
