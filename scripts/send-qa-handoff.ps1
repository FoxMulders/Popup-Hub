# send-qa-handoff.ps1
# Pre-flight production smoke + print QA handoff links (Linear primary, repo checklist fallback).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ''
Write-Host 'Popup Hub — QA handoff' -ForegroundColor White
Write-Host '======================' -ForegroundColor DarkGray

Write-Host ''
Write-Host '==> Production smoke' -ForegroundColor Cyan
npm run verify:prod
if ($LASTEXITCODE -ne 0) {
  throw 'Production smoke failed — fix before sending to QA'
}

$build = (Get-Content 'build-number.json' -Raw | ConvertFrom-Json)
$checklist = Join-Path $root 'docs/QA_TEST_REQUEST.md'

Write-Host ''
Write-Host '==> QA handoff ready' -ForegroundColor Green
Write-Host "    Build: v$($build.version) build $($build.build) @ $($build.commit)" -ForegroundColor DarkGray
Write-Host '    Checklist: docs/QA_TEST_REQUEST.md' -ForegroundColor DarkGray
Write-Host '    Linear:    https://linear.app/popuphub/issue/POP-5/qa-full-workflow-test-request-build-217' -ForegroundColor DarkGray
Write-Host '    Doc:       https://linear.app/popuphub/document/qa-test-checklist-build-217-fff43e29c970' -ForegroundColor DarkGray
Write-Host ''
Write-Host 'To create/update the Linear issue from Cursor, authenticate the Linear MCP plugin' -ForegroundColor DarkGray
Write-Host 'and ask the agent to send docs/QA_TEST_REQUEST.md to QA.' -ForegroundColor DarkGray
Write-Host ''
Write-Host 'Optional GitHub issue (requires gh auth login):' -ForegroundColor DarkGray
Write-Host '  gh issue create --title "QA: Full workflow test request" --body-file docs/QA_TEST_REQUEST.md' -ForegroundColor DarkGray

if (-not (Test-Path $checklist)) {
  throw "Missing checklist: $checklist"
}

exit 0
