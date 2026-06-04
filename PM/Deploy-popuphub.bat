@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM PopUp Hub — build, commit, sync push, Vercel prod, session handoff (single instance).
REM Works when: double-clicked in Explorer, run from cmd/PowerShell, any current directory.
REM
REM Usage:
REM   PM\Deploy-popuphub.bat [commit message] [--no-pause]
REM   PM\Deploy-popuphub.bat "fix: footer version row"
REM
REM Default commit message matches current WIP — override by passing a message as arg 1.
REM Bat-only flags (stripped before PowerShell): --no-pause / -NoPause

set "BAT_DIR=%~dp0"
set "REPO_ROOT=%BAT_DIR%.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

set "COMMIT_MSG="
set "DEPLOY_PS_ARGS="
:parseBatFlags
if "%~1"=="" goto :afterBatFlags
if /i "%~1"=="--no-pause" set "DEPLOY_NO_PAUSE=1" & shift & goto :parseBatFlags
if /i "%~1"=="-NoPause" set "DEPLOY_NO_PAUSE=1" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipBuild" set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS! -SkipBuild" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipCommit" set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS! -SkipCommit" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipDeploy" set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS! -SkipDeploy" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipHandoff" set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS! -SkipHandoff" & shift & goto :parseBatFlags
if not defined COMMIT_MSG (
    set "COMMIT_MSG=%~1"
    shift
    goto :parseBatFlags
)
set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS! %1"
shift
goto :parseBatFlags

:afterBatFlags
if not defined COMMIT_MSG set "COMMIT_MSG=feat: floor-plan object resize, measurements, viewport lock, and layout fixes"
if defined DEPLOY_PS_ARGS set "DEPLOY_PS_ARGS=!DEPLOY_PS_ARGS:~1!"

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

"%PS_EXE%" -NoProfile -ExecutionPolicy Bypass -File "%DEPLOY_PS1%" -Message "!COMMIT_MSG!" !DEPLOY_PS_ARGS!
set "EXITCODE=!ERRORLEVEL!"

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
