# qa-full-workflow.ps1
# Full cross-role QA: seed fixtures, RBAC, Playwright workflow, DB walkthrough.

param(
    [switch]$SkipPlaywright,
    [switch]$StagingSmoke
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
Write-Host "Popup Hub - Full Workflow QA" -ForegroundColor White
Write-Host "============================" -ForegroundColor DarkGray

try {
    if ($StagingSmoke) {
        Write-Host ""
        Write-Host "Staging/prod mode: manual checklist + HTTP smoke only." -ForegroundColor Yellow
        Write-Host "  Manual: docs/QA_FULL_WORKFLOW.md (Phase 8)" -ForegroundColor DarkGray
        Run-Step "Production HTTP smoke" "npm run verify:prod"
        exit 0
    }

    Run-Step "Seed test users + workflow fixtures" "npm run seed:test-users"
    Run-Step "Signup RBAC" "npm run test:rbac-signup"

    if (-not $SkipPlaywright) {
        Run-Step "Playwright workflow suite" "npm run test:e2e:workflow"
    }

    Run-Step "API/DB walkthrough" "npx tsx scripts/qa-full-workflow-walkthrough.ts"

    Write-Host ""
    Write-Host "==> Full workflow QA passed." -ForegroundColor Green
    Write-Host "    Manual checklist: docs/QA_FULL_WORKFLOW.md" -ForegroundColor DarkGray
    Write-Host "    Staging manual:   docs/QA_FULL_WORKFLOW.md (Phase 8)" -ForegroundColor DarkGray
    Write-Host "    Staging smoke:    .\scripts\qa-full-workflow.ps1 -StagingSmoke" -ForegroundColor DarkGray
    exit 0
}
catch {
    Write-Host ""
    Write-Host "==> Full workflow QA failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
