# Refresh PM/session-handoff.md baseline after a deploy or scoped task.
# Usage: .\scripts\update-session-handoff.ps1 [-DeployUrl <url>] [-Note <text>] [-CommitMessage <msg>]

param(
    [string]$DeployUrl = 'https://popuphub.ca',
    [string]$Note = '',
    [string]$CommitMessage = ''
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'get-deploy-commit-message.ps1')

function Get-SessionHandoffPaths {
    param([string]$Root)
    $primary = Join-Path $Root 'PM\session-handoff.md'
    if (Test-Path -LiteralPath $primary) {
        return @{ Full = $primary; Git = 'PM/session-handoff.md' }
    }
    $alt = Join-Path $Root 'pm\session-handoff.md'
    if (Test-Path -LiteralPath $alt) {
        return @{ Full = $alt; Git = 'PM/session-handoff.md' }
    }
    return $null
}

$handoff = Get-SessionHandoffPaths -Root $ProjectRoot
if (-not $handoff) {
    throw "Handoff file not found: PM/session-handoff.md under $ProjectRoot"
}
$HandoffPath = $handoff.Full
$HandoffGitPath = $handoff.Git
Push-Location $ProjectRoot
try {
    $branch = git rev-parse --abbrev-ref HEAD
    $commit = git rev-parse --short HEAD
    $pushed = 'local only'
    . "$PSScriptRoot\git-sync.ps1"
    $upstream = Get-GitUpstreamRef
    if ($upstream.RemoteRef) {
        git fetch origin 2>$null | Out-Null
        $local = git rev-parse HEAD
        $remote = git rev-parse $upstream.RemoteRef 2>$null
        if ($LASTEXITCODE -eq 0 -and $local -eq $remote) {
            $pushed = "pushed to ``$($upstream.RemoteRef)``"
        }
    }

    $buildLine = 'build unknown'
    $buildJson = Join-Path $ProjectRoot 'build-number.json'
    if (Test-Path $buildJson) {
        $bn = Get-Content $buildJson -Raw | ConvertFrom-Json
        $buildLine = "**build $($bn.build)** | commit ``$($bn.commit)``"
    }

    $date = Get-Date -Format 'yyyy-MM-dd HH:mm'
    $deployDate = Get-Date -Format 'yyyy-MM-dd'
    $content = Get-Content $HandoffPath -Raw
    $content = Mark-ShippedSectionsDeployed -Content $content -DeployedOn $deployDate

    $commitLine = if ($CommitMessage) {
        "- Last deploy commit: ``$commit`` - $CommitMessage"
    } else {
        ''
    }

    $baselineLines = @(
        '## Baseline',
        "- Branch: ``$branch`` @ ``$commit`` ($pushed)"
    )
    if ($commitLine) { $baselineLines += $commitLine }
    $baselineLines += @(
        "- Production: $DeployUrl - $buildLine (handoff updated $date)",
        '- **Deploy script:** `PM/Deploy-popuphub.bat` [commit message] -> `scripts/deploy-popuphub.ps1` (build, commit, sync push, Vercel prod, handoff)',
        '- **Stashed (not shipped):** `git stash` entry `loader WIP` - brand loader scene / `ship.ps1` tweaks on `feature/step-2-fix` (verify with `git stash list`)'
    )
    $baselineBlock = ($baselineLines -join "`r`n") + "`r`n"

    if ($content -match '(?s)## Baseline\r?\n.*?(?=\r?\n## )') {
        $content = $content -replace '(?s)## Baseline\r?\n.*?(?=\r?\n## )', ($baselineBlock + "`r`n")
    } else {
        throw 'Could not find ## Baseline section in session-handoff.md'
    }

    if ($Note) {
        $deployDetail = if ($CommitMessage) { "$Note - ``$CommitMessage``" } else { $Note }
        $deployLog = "## Last deploy`r`n- $date - $deployDetail ($commit)`r`n`r`n"
        if ($content -match '(?s)## Last deploy\r?\n.*?(?=\r?\n## )') {
            $content = $content -replace '(?s)## Last deploy\r?\n.*?(?=\r?\n## )', $deployLog
        } elseif ($content -match '(?s)(## Baseline\r?\n.*?\r?\n)(## )') {
            $content = $content -replace '(?s)(## Baseline\r?\n.*?\r?\n)(## )', "`$1$deployLog`$2"
        }
    }

    Set-Content -Path $HandoffPath -Value ($content.TrimEnd() + "`r`n") -NoNewline
    Write-Host "Updated $HandoffPath (baseline @ $commit)" -ForegroundColor Green

    $nextMessage = Sync-DeployCommitMessageArtifacts -ProjectRoot $ProjectRoot
    if ($nextMessage) {
        Write-Host "Next deploy commit message: $nextMessage" -ForegroundColor DarkGray
    } else {
        Write-Host 'Next deploy commit message: (none — add Shipped this session sections)' -ForegroundColor DarkGray
    }
} finally {
    Pop-Location
}
