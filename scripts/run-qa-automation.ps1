# run-qa-automation.ps1
# Static QA automation (CI-safe) + optional Playwright smoke when a server is available.

param(
    [switch]$SkipPlaywright,
    [switch]$ProdBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$reportPath = Join-Path $root 'PM/qa-automation-last-run.md'
$results = New-Object System.Collections.Generic.List[object]

function Run-Step($label, $command) {
    Write-Host ""
    Write-Host "==> $label" -ForegroundColor Cyan
    $output = Invoke-Expression $command 2>&1 | Out-String
    $exit = $LASTEXITCODE
    if ($output.Trim()) { Write-Host $output }
    $results.Add([pscustomobject]@{
        Step = $label
        Pass = ($exit -eq 0)
        Detail = if ($exit -eq 0) { 'PASS' } else { "exit $exit" }
    }) | Out-Null
    if ($exit -ne 0) {
        throw "$label failed (exit $exit)"
    }
}

Write-Host ""
Write-Host 'Popup Hub — QA automation' -ForegroundColor White
Write-Host '=========================' -ForegroundColor DarkGray

try {
    Run-Step 'TypeScript' 'npx tsc --noEmit'
    Run-Step 'Unit tests' 'npm run test:unit'
    Run-Step 'Signup RBAC' 'npm run test:rbac-signup'

    if (-not $SkipPlaywright) {
        if ($ProdBrowser) {
            $env:PLAYWRIGHT_BASE_URL = 'https://popuphub.ca'
            $env:PLAYWRIGHT_SKIP_WEBSERVER = '1'
            Run-Step 'Prod HTTP smoke' 'npm run verify:prod'
            Run-Step 'Prod Playwright — public discovery' 'npm run test:e2e:public-discovery'
            Run-Step 'Prod Playwright — HubGuard trust' 'npm run test:e2e:canopy'
            Run-Step 'Prod Playwright — discover UX' 'npm run test:e2e:discover-ux'
        } else {
            Run-Step 'Public discovery (local)' 'npm run test:e2e:public-discovery'
            Run-Step 'HubGuard trust (local)' 'npm run test:e2e:canopy'
            Run-Step 'Discover UX (local)' 'npm run test:e2e:discover-ux'
        }
    }

    $build = Get-Content 'build-number.json' -Raw | ConvertFrom-Json
    $passed = @($results | Where-Object { $_.Pass }).Count
    $total = $results.Count
    $timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')

    @(
        '# QA automation last run',
        '',
        "**When:** $timestamp",
        "**Build:** v$($build.version) build $($build.build) @ $($build.commit)",
        "**Result:** $passed / $total steps passed",
        '',
        '| Step | Result |',
        '|------|--------|',
        ($results | ForEach-Object { "| $($_.Step) | $(if ($_.Pass) { 'PASS' } else { 'FAIL' }) |" }),
        '',
        'Linear handoff: [POP-5](https://linear.app/popuphub/issue/POP-5/qa-full-workflow-test-request-build-217)',
        ''
    ) | Set-Content -Path $reportPath -Encoding utf8

    Write-Host ''
    Write-Host "==> QA automation passed ($passed/$total)." -ForegroundColor Green
    Write-Host "    Report: PM/qa-automation-last-run.md" -ForegroundColor DarkGray
    exit 0
}
catch {
    $build = Get-Content 'build-number.json' -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
    $timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    @(
        '# QA automation last run',
        '',
        "**When:** $timestamp",
        "**Build:** v$($build.version) build $($build.build) @ $($build.commit)",
        '**Result:** FAILED',
        '',
        "**Error:** $($_.Exception.Message)",
        '',
        '| Step | Result |',
        '|------|--------|',
        ($results | ForEach-Object { "| $($_.Step) | $(if ($_.Pass) { 'PASS' } else { 'FAIL' }) |" }),
        ''
    ) | Set-Content -Path $reportPath -Encoding utf8

    Write-Host ''
    Write-Host '==> QA automation failed:' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
