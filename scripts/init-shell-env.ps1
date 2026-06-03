# Refresh PATH (and common tool roots) for Explorer / minimal-env launches.
# Dot-source from deploy, ship, and other automation scripts.

function Initialize-ProjectShellEnv {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $parts = @()
    if ($machine) { $parts += $machine -split ';' }
    if ($user) { $parts += $user -split ';' }

    $extras = @(
        "$env:ProgramFiles\nodejs"
        "${env:ProgramFiles(x86)}\nodejs"
        "$env:LOCALAPPDATA\fnm_multishells"
        "$env:APPDATA\npm"
        "$env:ProgramFiles\Git\cmd"
        "$env:ProgramFiles\Git\bin"
    )
    foreach ($dir in $extras) {
        if ($dir -and (Test-Path -LiteralPath $dir)) {
            $parts += $dir
        }
    }

    $seen = @{}
    $merged = foreach ($p in $parts) {
        if (-not $p) { continue }
        $key = $p.TrimEnd('\').ToLowerInvariant()
        if ($seen.ContainsKey($key)) { continue }
        $seen[$key] = $true
        $p
    }
    $env:Path = ($merged -join ';')
}
