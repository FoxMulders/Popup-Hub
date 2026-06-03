# Shared git fetch / pull / push with race recovery. Dot-source from ship/deploy scripts.

function Write-GitLines {
    param([object[]]$Lines)
    foreach ($line in $Lines) {
        if ($null -eq $line) { continue }
        if ($line -is [System.Management.Automation.ErrorRecord]) {
            Write-Host $line.ToString()
        } else {
            Write-Host $line
        }
    }
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
        [string[]]$GitArgs
    )

    $prevEa = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = & git @GitArgs 2>&1
        Write-GitLines $output
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEa
    }
}

function Get-GitUpstreamRef {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    if (-not $branch) { throw 'Not in a git repository' }

    $upstream = git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null
    if ($upstream) {
        return @{ Branch = $branch; RemoteRef = $upstream }
    }

    $originRef = "origin/$branch"
    $null = git rev-parse $originRef 2>$null
    if ($LASTEXITCODE -eq 0) {
        return @{ Branch = $branch; RemoteRef = $originRef }
    }

    return @{ Branch = $branch; RemoteRef = $null }
}

function Sync-GitWithOrigin {
    param(
        [switch]$AllowRebase
    )

    if ((Invoke-Git fetch origin) -ne 0) { throw 'git fetch origin failed' }

    $info = Get-GitUpstreamRef
    $branch = $info.Branch
    $remoteRef = $info.RemoteRef

    if (-not $remoteRef) {
        Write-Host "No upstream for $branch; push will set origin/$branch." -ForegroundColor Yellow
        return $info
    }

    $null = git rev-parse $remoteRef 2>$null
    if ($LASTEXITCODE -ne 0) { return $info }

    $behind = [int](git rev-list --count "HEAD..$remoteRef" 2>$null)
    $ahead = [int](git rev-list --count "$remoteRef..HEAD" 2>$null)

    if ($behind -gt 0 -and $ahead -gt 0) {
        throw "Branch $branch diverged from $remoteRef ($behind behind, $ahead ahead). Resolve manually before deploy."
    }

    if ($behind -gt 0) {
        if (-not $AllowRebase) { throw "Branch $branch is $behind commit(s) behind $remoteRef. Pull or rebase first." }
        Write-Host "Rebasing onto $remoteRef ($behind commit(s) behind)..." -ForegroundColor Yellow
        if ((Invoke-Git pull --rebase origin $branch) -ne 0) { throw 'git pull --rebase failed' }
    }

    return $info
}

function Push-GitOriginHead {
    param(
        [int]$MaxAttempts = 2
    )

    $info = Get-GitUpstreamRef
    $remoteRef = $info.RemoteRef

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        if ((Invoke-Git push -u origin HEAD) -eq 0) { return }

        git fetch origin 2>$null
        $local = git rev-parse HEAD

        if ($remoteRef) {
            $null = git rev-parse $remoteRef 2>$null
            if ($LASTEXITCODE -eq 0) {
                $remote = git rev-parse $remoteRef
                if ($local -eq $remote) {
                    Write-Host "Push reported an error but $remoteRef already matches HEAD ($local)." -ForegroundColor Yellow
                    return
                }
            }
        }

        if ($attempt -lt $MaxAttempts) {
            Write-Host 'Push failed; fetching and retrying once...' -ForegroundColor Yellow
            Sync-GitWithOrigin -AllowRebase
            $info = Get-GitUpstreamRef
            $remoteRef = $info.RemoteRef
            continue
        }

        throw 'git push failed and remote is not in sync with HEAD'
    }
}

function Enter-DeployLock {
    param([string]$Name = 'popup-hub-deploy')

    $lockPath = Join-Path $env:TEMP "$Name.lock"
    $script:DeployLockPath = $lockPath
    $script:DeployLockStream = [System.IO.File]::Open(
        $lockPath,
        [System.IO.FileMode]::OpenOrCreate,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )
    Write-Host "Deploy lock: $lockPath" -ForegroundColor DarkGray
}

function Exit-DeployLock {
    if ($script:DeployLockStream) {
        $script:DeployLockStream.Dispose()
        $script:DeployLockStream = $null
    }
}
