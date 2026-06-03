# Shared git fetch / pull / push with race recovery. Dot-source from ship/deploy scripts.

function Get-NativeCommandLineText {
    param([object]$Line)

    if ($null -eq $Line) { return $null }
    if ($Line -is [System.Management.Automation.ErrorRecord]) {
        return $Line.ToString()
    }
    return [string]$Line
}

# Run a native exe without stderr tripping $ErrorActionPreference = 'Stop'.
# With -CaptureLines, returns @{ ExitCode; Lines } instead of an exit code alone.
function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [string[]]$ArgumentList = @(),
        [switch]$CaptureLines
    )

    $prevEa = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $captured = [System.Collections.Generic.List[string]]::new()
    try {
        $raw = if ($ArgumentList.Count -gt 0) {
            & $FilePath @ArgumentList 2>&1
        } else {
            & $FilePath 2>&1
        }
        foreach ($line in @($raw)) {
            $text = Get-NativeCommandLineText $line
            if (-not $text) { continue }
            Write-Host $text
            if ($CaptureLines) {
                [void]$captured.Add($text)
            }
        }
        $exitCode = 0
        if ($null -ne $LASTEXITCODE) {
            $exitCode = [int]$LASTEXITCODE
        }
        if ($CaptureLines) {
            return @{ ExitCode = $exitCode; Lines = $captured }
        }
        return $exitCode
    } finally {
        $ErrorActionPreference = $prevEa
    }
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
        [string[]]$GitArgs
    )

    return Invoke-NativeCommand -FilePath 'git' -ArgumentList $GitArgs
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

        $null = Invoke-Git fetch origin
        $local = (git rev-parse HEAD 2>$null | Out-String).Trim()

        if ($remoteRef) {
            if ((Invoke-Git rev-parse $remoteRef) -eq 0) {
                $remote = (git rev-parse $remoteRef 2>$null | Out-String).Trim()
                if ($local -eq $remote) {
                    Write-Host "Push reported an error but $remoteRef already matches HEAD ($local)." -ForegroundColor Yellow
                    return
                }
            }
        }

        if ($attempt -lt $MaxAttempts) {
            Write-Host 'Push failed; fetching and retrying once...' -ForegroundColor Yellow
            $null = Sync-GitWithOrigin -AllowRebase
            $info = Get-GitUpstreamRef
            $remoteRef = $info.RemoteRef
            continue
        }

        throw 'git push failed and remote is not in sync with HEAD'
    }
}

function Clear-StaleDeployLock {
    param([string]$LockPath)

    if (-not (Test-Path -LiteralPath $LockPath)) { return $false }

    try {
        $meta = Get-Content -LiteralPath $LockPath -Raw -ErrorAction Stop
        if ($meta -match 'pid:(\d+)') {
            $ownerPid = [int]$Matches[1]
            if ($ownerPid -eq $PID) { return $false }
            $proc = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
            if ($proc) { return $false }
        }
        Remove-Item -LiteralPath $LockPath -Force -ErrorAction Stop
        Write-Host "Removed stale deploy lock (owner process not running): $LockPath" -ForegroundColor Yellow
        return $true
    } catch {
        return $false
    }
}

function Enter-DeployLock {
    param([string]$Name = 'popup-hub-deploy')

    $lockPath = Join-Path $env:TEMP "$Name.lock"
    $script:DeployLockPath = $lockPath

    for ($attempt = 1; $attempt -le 2; $attempt++) {
        try {
            $script:DeployLockStream = [System.IO.File]::Open(
                $lockPath,
                [System.IO.FileMode]::OpenOrCreate,
                [System.IO.FileAccess]::ReadWrite,
                [System.IO.FileShare]::None
            )
            $script:DeployLockStream.SetLength(0)
            $writer = New-Object System.IO.StreamWriter($script:DeployLockStream, [System.Text.UTF8Encoding]::new($false))
            $writer.Write("pid:$PID")
            $writer.Flush()
            $script:DeployLockStream.Flush()
            Write-Host "Deploy lock: $lockPath" -ForegroundColor DarkGray
            return
        } catch {
            if ($attempt -eq 1 -and (Clear-StaleDeployLock -LockPath $lockPath)) {
                continue
            }
            throw
        }
    }
}

function Exit-DeployLock {
    if ($script:DeployLockStream) {
        $script:DeployLockStream.Dispose()
        $script:DeployLockStream = $null
    }
}
