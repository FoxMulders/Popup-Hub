@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM PopUp Hub - build, commit, sync push, Vercel prod, session handoff (single instance).
REM Works when: double-clicked in Explorer, run from cmd/PowerShell, any current directory.
REM Next commit (auto): feat: Unified Auto-Arrange + Patron Flow solver
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