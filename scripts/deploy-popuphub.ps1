# One-click deploy: build, commit, sync with origin, push, Vercel prod, session handoff.
#
# GitHub Actions alternative (Cursor mobile / no local CLI):
#   Actions → Deploy to Vercel Production — see PM/vercel-github-actions.md
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

function Write-NothingToShipGuidance {
    param(
        [string]$Branch,
        [string]$Commit,
        [bool]$HasLocalChanges
    )

    Write-Host ''
    Write-Host 'Nothing new to ship.' -ForegroundColor Yellow
    Write-Host '  Working tree is clean and no undeployed handoff sections were found.' -ForegroundColor Gray
    Write-Host "  Branch: $Branch @ $Commit" -ForegroundColor Gray
    Write-Host '  Production: https://popuphub.ca' -ForegroundColor Gray
    Write-Host ''
    Write-Host 'Deploy picks commit messages automatically from (in order):' -ForegroundColor Cyan
    Write-Host '  1. ## Shipped this session (title, not deployed)' -ForegroundColor White
    Write-Host '  2. ## Active work — title (local, not deployed)' -ForegroundColor White
    Write-Host '  3. feat: ship local changes (when you have uncommitted work)' -ForegroundColor White
    Write-Host ''
    Write-Host 'To redeploy production without a new commit:' -ForegroundColor Cyan
    Write-Host '  PM\Deploy-popuphub.bat -SkipCommit' -ForegroundColor White
    Write-Host ''
}

if ($MessageArgs -and $MessageArgs.Count -gt 0) {
    $Message = $MessageArgs -join ' '
}

$deployHandoffPlan = Get-DeployHandoffPlan -ProjectRoot $ProjectRoot -AllowLocalChangesFallback
$handoffMessage = Sync-DeployCommitMessageArtifacts -ProjectRoot $ProjectRoot -Message $deployHandoffPlan.Message
if (-not $Message) {
    $Message = $handoffMessage
}
if (-not $Message) {
    Push-Location $ProjectRoot
    try {
        $branch = git rev-parse --abbrev-ref HEAD 2>$null
        $commit = git rev-parse --short HEAD 2>$null
        $hasLocalChanges = [bool](git status --porcelain)

        if ($SkipCommit) {
            Write-Host 'Redeploy mode (-SkipCommit): continuing without a new commit.' -ForegroundColor DarkGray
        } else {
            Write-NothingToShipGuidance -Branch $branch -Commit $commit -HasLocalChanges:$hasLocalChanges
            Write-Host '==> No deploy performed (already up to date).' -ForegroundColor Green
            exit 2
        }
    } finally {
        Pop-Location
    }
}

if ($deployHandoffPlan.Source -eq 'active-work') {
    Write-Host "Deploy commit source: Active work handoff sections ($($deployHandoffPlan.ActiveWorkTitles.Count) titles)" -ForegroundColor DarkGray
} elseif ($deployHandoffPlan.Source -eq 'local-changes') {
    Write-Host 'Deploy commit source: uncommitted local changes (no undeployed handoff sections)' -ForegroundColor DarkGray
}

if ($Message) {
    Write-Host "Deploy commit message (auto): $Message" -ForegroundColor DarkGray
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
        if (-not $SkipCommit -and $Message) {
            Write-Step 'Bumping semver from deploy commit message'
            $versionArgs = @('scripts/bump-package-version.mjs', '--message', $Message)
            if ((Invoke-NativeCommand -FilePath 'node' -ArgumentList $versionArgs) -ne 0) {
                throw 'Semver bump failed'
            }
        }

        Write-Step 'Cleaning stale .next output'
        $env:NODE_OPTIONS = '--max-old-space-size=8192'
        if ((Invoke-NativeCommand -FilePath 'node' -ArgumentList @('scripts/clean-next-build.mjs', '--strict', '--stop-dev')) -ne 0) {
            throw 'Could not remove stale .next build output'
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
        & (Join-Path $PSScriptRoot 'update-session-handoff.ps1') -DeployUrl $handoffProdUrl -Note 'Deploy via deploy-popuphub.ps1' -CommitMessage $Message -ActiveWorkTitlesToMark $deployHandoffPlan.ActiveWorkTitles

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
