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
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $ProjectRoot

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

try {
    Write-Step "Building (next build)"
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Build failed" }

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
        Write-Step "Pushing to origin"
        git push origin HEAD
        if ($LASTEXITCODE -ne 0) { throw "Push failed" }
    }

    if (-not $SkipDeploy) {
        Write-Step "Deploying to Vercel (production)"
        npx vercel deploy --prod
        if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }
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
