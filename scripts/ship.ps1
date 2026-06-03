# ship.ps1
# Build, commit, push, and deploy to Vercel production.
#
# Usage:
#   .\scripts\ship.ps1 -Message "feat: my change"
#   .\scripts\ship.ps1 -SkipCommit -Message "deploy only"
#   npm run ship -- "feat: my change"

param(
    [Parameter(Mandatory = $true)]
    [string]$Message,
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

Initialize-ProjectShellEnv
Push-Location $ProjectRoot

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

try {
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
        if ((Invoke-NativeCommand -FilePath 'npx' -ArgumentList @('vercel', 'deploy', '--prod', '--yes')) -ne 0) { throw "Deploy failed" }
    }

    Write-Step "Updating session handoff"
    & (Join-Path $PSScriptRoot 'update-session-handoff.ps1') -Note "Ship via ship.ps1"
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
