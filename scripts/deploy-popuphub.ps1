# One-click deploy: build, commit, sync with origin, push, Vercel prod, session handoff.
#
# Usage:
#   .\scripts\deploy-popuphub.ps1
#   .\scripts\deploy-popuphub.ps1 -Message "fix: footer version row"
#   PM\Deploy-popuphub.bat
# Commit message is always derived from PM/session-handoff.md (override rarely via -Message).

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
. (Join-Path $PSScriptRoot 'get-deploy-commit-message.ps1')

Initialize-ProjectShellEnv

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

if ($MessageArgs -and $MessageArgs.Count -gt 0) {
    $Message = $MessageArgs -join ' '
}

$handoffMessage = Sync-DeployCommitMessageArtifacts -ProjectRoot $ProjectRoot
if (-not $Message) {
    $Message = $handoffMessage
}
if (-not $Message) {
    Write-Host 'No undeployed sections in PM/session-handoff.md — nothing to ship.' -ForegroundColor Red
    Write-Host 'Add ## Shipped this session (... , not deployed) blocks, then run deploy again.' -ForegroundColor Yellow
    exit 1
}

Write-Host "Deploy commit message (auto): $Message" -ForegroundColor DarkGray

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
        $nextBuildLock = Join-Path $ProjectRoot '.next\lock'
        if (Test-Path -LiteralPath $nextBuildLock) {
            Remove-Item -LiteralPath $nextBuildLock -Force
            Write-Host "Removed stale Next.js build lock: $nextBuildLock" -ForegroundColor Yellow
        }

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
            git commit -m "$Message"
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
        Write-Host 'Remote build usually takes 3-6 minutes; upload/build logs stream below.' -ForegroundColor DarkGray
        $deployResult = Invoke-VercelProdDeploy -CaptureLines
        if ($deployResult.ExitCode -ne 0) { throw 'Vercel deploy failed' }
        $urlMatch = ($deployResult.Lines | Select-String -Pattern 'https://[^\s]+\.vercel\.app' -AllMatches | Select-Object -Last 1)
        if ($urlMatch) {
            $deployUrl = $urlMatch.Matches[0].Value
        }
    }

    if (-not $SkipHandoff) {
        Write-Step 'Updating session handoff'
        $short = git rev-parse --short HEAD
        $handoffProdUrl = 'https://popuphub.ca'
        & (Join-Path $PSScriptRoot 'update-session-handoff.ps1') -DeployUrl $handoffProdUrl -Note 'Deploy via deploy-popuphub.ps1' -CommitMessage $Message

        $handoffPaths = @(
            'PM/session-handoff.md',
            'PM/Deploy-popuphub.bat',
            'PM/deploy-commit-message.txt'
        )
        $handoffStatus = git status --porcelain -- @handoffPaths
        if ($handoffStatus) {
            git add -- @handoffPaths
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
