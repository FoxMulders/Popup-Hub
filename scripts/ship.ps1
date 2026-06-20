# ship.ps1
# Build, commit, push, and deploy to Vercel production.
#
# Usage:
#   .\scripts\ship.ps1 -Message "feat: my change"
#   .\scripts\ship.ps1 -SkipCommit -Message "deploy only"
#   npm run ship -- "feat: my change"

param(
    [string]$Message = '',
    [switch]$SkipCommit,
    [switch]$SkipDeploy,
    [switch]$SkipPush
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
Push-Location $ProjectRoot

$deployHandoffPlan = Get-DeployHandoffPlan -ProjectRoot $ProjectRoot -AllowLocalChangesFallback
$handoffMessage = Sync-DeployCommitMessageArtifacts -ProjectRoot $ProjectRoot -Message $deployHandoffPlan.Message
if (-not $Message) { $Message = $handoffMessage }
if (-not $Message) { throw 'No deploy commit message — working tree is clean and handoff has no undeployed sections' }

Write-Host "Ship commit message (auto): $Message" -ForegroundColor DarkGray

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

try {
    if (-not $SkipCommit -and $Message) {
        Write-Step 'Bumping semver from ship commit message'
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

    Write-Step "Building (next build)"
    $env:BUMP_BUILD_NUMBER = "1"
    if ((Invoke-NativeCommand -FilePath 'npm' -ArgumentList @('run', 'build')) -ne 0) { throw "Build failed" }

    if (-not $SkipCommit) {
        Write-Step "Staging source (excluding .next, .env*, secrets)"
        git add -A
        git reset HEAD -- .next 2>$null
        git reset HEAD -- .env.local 2>$null
        git reset HEAD -- .env 2>$null
        git reset HEAD -- .cert 2>$null

        $status = git status --porcelain
        if ($status) {
            Write-Step "Commit: $Message"
            git commit -m "$Message"
            if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
        } else {
            Write-Host "Nothing to commit." -ForegroundColor Yellow
        }
    }

    if (-not $SkipPush) {
        Write-Step "Syncing with origin"
        $null = Sync-GitWithOrigin -AllowRebase
        Write-Step "Pushing to origin"
        Push-GitOriginHead
    }

    if (-not $SkipDeploy) {
        Write-Step "Deploying to Vercel (production)"
        Write-Host "Remote build usually takes 3-6 minutes; upload/build logs stream below." -ForegroundColor DarkGray
        if ((Invoke-VercelProdDeploy) -ne 0) { throw "Deploy failed" }
    }

    Write-Step "Updating session handoff"
    & (Join-Path $PSScriptRoot 'update-session-handoff.ps1') -Note 'Ship via ship.ps1' -CommitMessage $Message -ActiveWorkTitlesToMark $deployHandoffPlan.ActiveWorkTitles
    $handoffStatus = git status --porcelain -- 'PM/session-handoff.md'
    if ($handoffStatus) {
        git add PM/session-handoff.md
        $short = git rev-parse --short HEAD
        git commit -m "docs: session handoff after ship ($short)"
        if ($LASTEXITCODE -ne 0) { throw "Handoff commit failed" }
        if (-not $SkipPush) { Push-GitOriginHead }
    }

    Write-Host ""
    Write-Host "==> Ship complete." -ForegroundColor Green
    Write-Host "    https://popup-hub.vercel.app" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host ""
    Write-Host "==> Ship failed: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}
