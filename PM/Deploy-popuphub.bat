@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM PopUp Hub - build, commit, sync push, Vercel prod, session handoff (single instance).
REM Works when: double-clicked in Explorer, run from cmd/PowerShell, any current directory.
REM Next commit (auto): feat: ship 5 session updates (Coordinator setup  admin queue polish; Quarter auction paddle purchase  bid flow; Square Reader affiliate on Market Supplies; Split-story banner placement; +1 more)
REM
REM Commit message is auto-generated from handoff Shipped / Active work sections,
REM or "feat: ship local changes" when uncommitted work exists.
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

set "DPL_PS_ARGS="
:parseBatFlags
if "%~1"=="" goto :afterBatFlags
if /i "%~1"=="--no-pause" set "DPL_NO_PAUSE=1" & shift & goto :parseBatFlags
if /i "%~1"=="-NoPause" set "DPL_NO_PAUSE=1" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipBuild" set "DPL_PS_ARGS=!DPL_PS_ARGS! -SkipBuild" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipCommit" set "DPL_PS_ARGS=!DPL_PS_ARGS! -SkipCommit" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipDeploy" set "DPL_PS_ARGS=!DPL_PS_ARGS! -SkipDeploy" & shift & goto :parseBatFlags
if /i "%~1"=="-SkipHandoff" set "DPL_PS_ARGS=!DPL_PS_ARGS! -SkipHandoff" & shift & goto :parseBatFlags
echo Unknown flag: %~1
set "DPL_EXIT=1"
goto :fail

:afterBatFlags

cd /d "!REPO_ROOT!"
if errorlevel 1 (
    echo Could not change to repo root:
    echo   !REPO_ROOT!
    set "DPL_EXIT=1"
    goto :fail
)

if not exist "!REPO_ROOT!\.git\" (
    echo Not a git repository:
    echo   !REPO_ROOT!
    set "DPL_EXIT=1"
    goto :fail
)

REM DPL_* names avoid cmd parsing %DE inside %DEPLOY_*% (PLOY_PS1 is not recognized).
set "DPL_SCRIPT=!REPO_ROOT!\scripts\deploy-popuphub.ps1"
if not exist "!DPL_SCRIPT!" (
    echo Missing deploy script:
    echo   !DPL_SCRIPT!
    set "DPL_EXIT=1"
    goto :fail
)

set "PS_EXE="
where pwsh >nul 2>&1
if not errorlevel 1 set "PS_EXE=pwsh.exe"
if not defined PS_EXE set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "!PS_EXE!" set "PS_EXE=powershell.exe"

set "BUMP_BUILD_NUMBER=1"
if defined DPL_PS_ARGS set "DPL_PS_ARGS=!DPL_PS_ARGS:~1!"

if defined DPL_PS_ARGS (
    "!PS_EXE!" -NoProfile -ExecutionPolicy Bypass -File "!DPL_SCRIPT!" !DPL_PS_ARGS!
) else (
    "!PS_EXE!" -NoProfile -ExecutionPolicy Bypass -File "!DPL_SCRIPT!"
)
set "DPL_EXIT=!ERRORLEVEL!"

if "!DPL_EXIT!"=="2" (
    echo.
    echo Nothing to deploy. See messages above.
    set "DPL_EXIT=0"
    goto :done
)

if not "!DPL_EXIT!"=="0" goto :fail

echo.
echo Deploy finished successfully.
goto :done

:fail
if not defined DPL_EXIT set "DPL_EXIT=1"
echo.
echo Deploy failed. Exit code: !DPL_EXIT!
echo See messages above.

:done
call :maybe_pause
exit /b !DPL_EXIT!

:maybe_pause
if defined DPL_NO_PAUSE exit /b 0
if defined CI exit /b 0
echo %CMDCMDLINE% | findstr /i /c:"/c" >nul 2>&1
if not errorlevel 1 (
    echo.
    pause
)
exit /b 0