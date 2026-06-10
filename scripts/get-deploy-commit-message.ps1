# Derive deploy commit message from PM/session-handoff.md undeployed session sections.

function Get-DeployCommitMessagePreviewText {
    param([string]$Message)

    if ($Message) { return Sanitize-BatRemComment -Text $Message }
    return '(none - add ## Shipped this session (... , not deployed) to PM/session-handoff.md)'
}

# cmd.exe reads .bat as ANSI — UTF-8 em dashes and shell metacharacters can break `set` lines.
function Sanitize-BatRemComment {
    param([string]$Text)

    if (-not $Text) { return '' }
    $safe = $Text -replace "[\u2013\u2014]", '-'
    $safe = $safe -replace "[\r\n]+", ' '
    $safe = $safe -replace '[&|<>%^!]', ''
    return $safe.Trim()
}

function Get-UndeployedHandoffTitles {
    param([string]$ProjectRoot)

    $handoffPath = Join-Path $ProjectRoot 'PM\session-handoff.md'
    if (-not (Test-Path -LiteralPath $handoffPath)) {
        return @()
    }

    $titles = [System.Collections.Generic.List[string]]::new()
    foreach ($line in Get-Content -LiteralPath $handoffPath) {
        if ($line -match '^## Shipped .+\((.+?), not deployed\)') {
            [void]$titles.Add($Matches[1].Trim())
            continue
        }
        if ($line -match '^## Shipped .+\((.+?)[\s\u2014-]+not deployed\)') {
            [void]$titles.Add($Matches[1].Trim().TrimEnd(','))
            continue
        }
        if ($line -match '^## Shipped .+\(not deployed\)') {
            [void]$titles.Add(($line -replace '^##\s+', '').Trim())
        }
    }
    # Unary comma — single title must stay a one-element array, not a scalar string
    # (otherwise "feat: $($titles[0])" indexes the first character).
    return ,@($titles.ToArray())
}

function Get-DeployBatFileContent {
    param([string]$PreviewText)

    return @"
@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM PopUp Hub - build, commit, sync push, Vercel prod, session handoff (single instance).
REM Works when: double-clicked in Explorer, run from cmd/PowerShell, any current directory.
REM Next commit (auto): $PreviewText
REM
REM Commit message is always auto-generated from PM/session-handoff.md undeployed
REM Shipped sections. Update handoff after each scoped task; double-click to ship.
REM Preview line above and PM/deploy-commit-message.txt refresh automatically.
REM
REM Vercel: git push does NOT auto-deploy master (vercel.json git.deploymentEnabled).
REM   Production deploy is CLI-only via deploy-popuphub.ps1 - avoids duplicate builds.
REM
REM Pipeline: build -> commit (auto message) -> push -> vercel deploy --prod -> handoff
REM
REM Usage:
REM   PM\Deploy-popuphub.bat [--no-pause]
REM   PM\Deploy-popuphub.bat -SkipCommit              (redeploy prod, no new commit)
REM   PM\Deploy-popuphub.bat -SkipBuild -SkipCommit   (fast redeploy)
REM
REM Bat-only flags: --no-pause / -NoPause
REM PowerShell passthrough: -SkipBuild -SkipCommit -SkipDeploy -SkipHandoff

set "BAT_DIR=%~dp0"
set "REPO_ROOT=%BAT_DIR%.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

set "DEPLOY_PS_ARGS="
:parseBatFlags
if "%~1"=="" goto :afterBatFlags
if /i "%~1"=="--no-pause" set "DEPLOY_NO_PAUSE=1" & shift & goto :parseBatFlags
if /i "%~1"=="-NoPause" set "DEPLOY_NO_PAUSE=1" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipBuild" set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS! -SkipBuild" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipCommit" set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS! -SkipCommit" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipDeploy" set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS! -SkipDeploy" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipHandoff" set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS! -SkipHandoff" & shift & goto :parseBatFlags
echo Unknown flag: %~1
set "EXITCODE=1"
goto :fail

:afterBatFlags

cd /d "%REPO_ROOT%"
if errorlevel 1 (
    echo Could not change to repo root:
    echo   %REPO_ROOT%
    set "EXITCODE=1"
    goto :fail
)

if not exist "%REPO_ROOT%\.git\" (
    echo Not a git repository:
    echo   %REPO_ROOT%
    set "EXITCODE=1"
    goto :fail
)

set "DEPLOY_PS1=%REPO_ROOT%\scripts\deploy-popuphub.ps1"
if not exist "%DEPLOY_PS1%" (
    echo Missing deploy script:
    echo   %DEPLOY_PS1%
    set "EXITCODE=1"
    goto :fail
)

set "PS_EXE="
where pwsh >nul 2>&1
if not errorlevel 1 set "PS_EXE=pwsh.exe"
if not defined PS_EXE set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS_EXE%" set "PS_EXE=powershell.exe"

set "BUMP_BUILD_NUMBER=1"
if defined DEPLOY_PS_ARGS set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS:~1!"

if defined DEPLOY_PS_ARGS (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%DEPLOY_PS1%" %DEPLOY_PS_ARGS%
) else (
    "%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%DEPLOY_PS1%"
)
set "EXITCODE=!ERRORLEVEL!"

if "!EXITCODE!"=="2" (
    echo.
    echo Nothing to deploy. See messages above.
    set "EXITCODE=0"
    goto :done
)

if not "!EXITCODE!"=="0" goto :fail

echo.
echo Deploy finished successfully.
goto :done

:fail
if not defined EXITCODE set "EXITCODE=1"
echo.
echo Deploy failed. Exit code: !EXITCODE!
echo See messages above.

:done
call :maybe_pause
exit /b !EXITCODE!

:maybe_pause
if defined DEPLOY_NO_PAUSE exit /b 0
if defined CI exit /b 0
echo %CMDCMDLINE% | findstr /i /c:"/c" >nul 2>&1
if not errorlevel 1 (
    echo.
    pause
)
exit /b 0
"@
}

function Update-DeployBatCommitMessageLine {
    param(
        [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
        [string]$PreviewText
    )

    $batPath = Join-Path $ProjectRoot 'PM\Deploy-popuphub.bat'
    $content = Get-DeployBatFileContent -PreviewText $PreviewText
    $normalized = ($content -replace "`r`n", "`n") -replace "`n", "`r`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [IO.File]::WriteAllText($batPath, $normalized, $utf8NoBom)
}

function Sync-DeployCommitMessageArtifacts {
    param(
        [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
        [string]$Message = ''
    )

    if (-not $Message) {
        $Message = Get-DeployCommitMessageFromHandoff -ProjectRoot $ProjectRoot
    }

    $preview = Get-DeployCommitMessagePreviewText -Message $Message
    Update-DeployBatCommitMessageLine -ProjectRoot $ProjectRoot -PreviewText $preview

    $msgPath = Join-Path $ProjectRoot 'PM\deploy-commit-message.txt'
    [IO.File]::WriteAllText($msgPath, $(if ($Message) { $Message } else { '' }))

    return $Message
}

function Get-DeployCommitMessageFromHandoff {
    param(
        [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
        [int]$MaxTitlesInSummary = 4
    )

    $handoffPath = Join-Path $ProjectRoot 'PM\session-handoff.md'
    if (-not (Test-Path -LiteralPath $handoffPath)) {
        return $null
    }

    $titles = Get-UndeployedHandoffTitles -ProjectRoot $ProjectRoot

    if ($titles.Count -eq 0) { return $null }
    if ($titles.Count -eq 1) {
        return "feat: $($titles[0])"
    }

    $listed = @($titles | Select-Object -First $MaxTitlesInSummary)
    $extra = $titles.Count - $listed.Count
    $summary = $listed -join '; '
    if ($extra -gt 0) {
        $summary += "; +$extra more"
    }
    return "feat: ship $($titles.Count) session updates ($summary)"
}

function Mark-ShippedSectionsDeployed {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content,
        [string]$DeployedOn = (Get-Date -Format 'yyyy-MM-dd')
    )

    $content = [regex]::Replace(
        $Content,
        '(?m)^## Shipped .+\((.+?), not deployed\)',
        "## Shipped this session (`$1, deployed $DeployedOn)"
    )
    $content = [regex]::Replace(
        $content,
        '(?m)^## Shipped .+\((.+?)[\s\u2014-]+not deployed\)',
        "## Shipped this session (`$1, deployed $DeployedOn)"
    )
    return [regex]::Replace(
        $content,
        '(?m)^(## Shipped .+\()not deployed(\))',
        "`${1}deployed $DeployedOn)"
    )
}
