@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM PopUp Hub — build, commit, sync push, Vercel prod, session handoff (single instance).
REM Works when: double-clicked in Explorer, run from cmd/PowerShell, any current directory.
REM
REM ---- Version tracking: floor-plan resize, measurements, viewport lock, layout fixes ----
REM Release track : feat: floor-plan object resize, measurements, viewport lock, and layout fixes
REM Last prod ship : build 155 @ 7db76c6 (2026-06-07) - https://popuphub.ca
REM
REM Shipped in this track (client-side canvas; no feature flags or NEXT_PUBLIC_* vars):
REM   Object resize     - 8 corner/edge handles on selected booths, tables, walls, stages
REM                         (object-resize.ts, SelectionOverlay; snap grid, bounds, overlap rules)
REM   Measurements      - single-select W x H (or diameter for round guest tables) on-canvas
REM                         and in toolbar Table size pill (formatObjectDimensions)
REM   Viewport lock     - ResizeObserver reframes once when viewport becomes measurable;
REM                         roomsFramingKey excludes room origin drag so pan/zoom is not reset
REM   Layout fixes      - Vendor/Patron/Room toolbar blocks; table-size pill template vs selection;
REM                         room drag/resize handles; merge/distribute; wizard QA pointer parity
REM
REM Touch files (representative): floor-plan-v2.tsx, floor-plan-canvas.tsx, use-canvas-pointer.ts,
REM   object-resize.ts, canvas-overlays.tsx, canvas-command-bar*.tsx, globals.css (scrollbar-modern)
REM
REM Build env (inherited by scripts\deploy-popuphub.ps1; no floor-plan-specific overrides):
REM   BUMP_BUILD_NUMBER=1  - prebuild bumps build-number.json via scripts\bump-build-number.mjs
REM   (Vercel prod uses linked project env from dashboard; no extra vars for this release.)
REM
REM Pipeline sequence (deploy-popuphub.ps1; no .next cache purge required for this track):
REM   1. npm run build          (prebuild bump + next build)
REM   2. git add/commit         (.next, .env*, .cert excluded)
REM   3. sync + push origin
REM   4. npx vercel deploy --prod --yes
REM   5. update-session-handoff.ps1 + handoff commit
REM
REM Optional pre-deploy verify (manual; not run by this script):
REM   npx tsx scripts\verify-canvas-state-smoke.ts
REM   npx tsx scripts\verify-multi-room-canvas.ts
REM   npx tsx scripts\verify-align-and-center.ts
REM ---- end version tracking ----
REM
REM Usage:
REM   PM\Deploy-popuphub.bat [commit message] [--no-pause]
REM   PM\Deploy-popuphub.bat "fix: footer version row"
REM   PM\Deploy-popuphub.bat -SkipBuild -SkipCommit   (deploy-only)
REM
REM Default commit message matches current WIP release track — override by passing arg 1.
REM Bat-only flags (stripped before PowerShell): --no-pause / -NoPause
REM PowerShell passthrough: -SkipBuild -SkipCommit -SkipDeploy -SkipHandoff

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

REM Standard prod build bump (deploy-popuphub.ps1 also sets this before npm run build).
set "BUMP_BUILD_NUMBER=1"

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
