# One-click deploy: build, commit, sync with origin, push, Vercel prod, session handoff.
#
# Usage:
#   .\scripts\deploy-popuphub.ps1
#   .\scripts\deploy-popuphub.ps1 -Message "fix: footer version row"
#   PM\Deploy-popuphub.bat "fix: footer version row"

param(
    [string]$Message = '',
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$MessageArgs,
    [switch]$SkipBuild,
    [switch]$SkipCommit,
    [switch]$SkipDeploy,
    [switch]$SkipHandoff
)

$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
$ProjectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'init-shell-env.ps1')
. (Join-Path $PSScriptRoot 'git-sync.ps1')

Initialize-ProjectShellEnv

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

if ($MessageArgs -and $MessageArgs.Count -gt 0) {
    $Message = $MessageArgs -join ' '
}
if (-not $Message) {
    $Message = "chore: deploy popuphub ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
}

function Test-CommandAvailable($name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    return [bool]$cmd
}

if (-not (Test-CommandAvailable 'git')) {
    Write-Host 'git not found on PATH. Install Git for Windows or run from a dev shell.' -ForegroundColor Red
    exit 1
}
if (-not (Test-CommandAvailable 'npm')) {
    Write-Host 'npm not found on PATH after Initialize-ProjectShellEnv. Install Node.js or open a dev shell.' -ForegroundColor Red
    exit 1
}

Push-Location $ProjectRoot
$deployLockHeld = $false
try {
    try {
        Enter-DeployLock
        $deployLockHeld = $true
    } catch {
        Write-Host ''
        Write-Host "Another deploy is already running (lock in `$env:TEMP). Wait for it to finish." -ForegroundColor Red
        exit 1
    }

    if (-not $SkipBuild) {
        Write-Step 'Building (next build)'
        $env:BUMP_BUILD_NUMBER = '1'
        if ((Invoke-NativeCommand -FilePath 'npm' -ArgumentList @('run', 'build')) -ne 0) { throw 'Build failed' }
    }

    if (-not $SkipCommit) {
        Write-Step 'Staging source (excluding .next, .env*, secrets)'
        git add -A
        git reset HEAD -- .next 2>$null
        git reset HEAD -- .env.local 2>$null
        git reset HEAD -- .env 2>$null
        git reset HEAD -- .cert 2>$null

        $status = git status --porcelain
        if ($status) {
            Write-Step "Commit: $Message"
            git commit -m $Message
            if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
        } else {
            Write-Host 'Nothing to commit.' -ForegroundColor Yellow
        }
    }

    Write-Step 'Syncing with origin'
    $null = Sync-GitWithOrigin -AllowRebase

    Write-Step 'Pushing to origin'
    Push-GitOriginHead

    $deployUrl = 'https://popuphub.ca'
    if (-not $SkipDeploy) {
        Write-Step 'Deploying to Vercel (production)'
        $deployResult = Invoke-NativeCommand -FilePath 'npx' -ArgumentList @('vercel', 'deploy', '--prod', '--yes') -CaptureLines
        if ($deployResult.ExitCode -ne 0) { throw 'Vercel deploy failed' }
        $urlMatch = ($deployResult.Lines | Select-String -Pattern 'https://[^\s]+\.vercel\.app' -AllMatches | Select-Object -Last 1)
        if ($urlMatch) {
            $deployUrl = $urlMatch.Matches[0].Value
        }
    }

    if (-not $SkipHandoff) {
        Write-Step 'Updating session handoff'
        $short = git rev-parse --short HEAD
        & (Join-Path $PSScriptRoot 'update-session-handoff.ps1') -DeployUrl $deployUrl -Note "Deploy via deploy-popuphub.ps1"

        $handoffGit = 'PM/session-handoff.md'
        $handoffStatus = git status --porcelain -- $handoffGit
        if ($handoffStatus) {
            git add -- $handoffGit
            git commit -m "docs: session handoff after deploy ($short)"
            if ($LASTEXITCODE -ne 0) { throw 'Handoff commit failed' }
            Push-GitOriginHead
        }
    }

    Write-Host ''
    Write-Host '==> Deploy complete.' -ForegroundColor Green
    Write-Host "    Branch: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)" -ForegroundColor Gray
    Write-Host "    Production: https://popuphub.ca" -ForegroundColor Gray
    Write-Host ''
    exit 0
} catch {
    Write-Host ''
    $failMsg = if ($_.Exception -and $_.Exception.Message) { $_.Exception.Message } else { "$_" }
    Write-Host "==> Deploy failed: $failMsg" -ForegroundColor Red
    exit 1
} finally {
    Exit-DeployLock
    Pop-Location
}
