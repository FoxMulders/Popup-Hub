@echo off
cd /d "%~dp0"
echo Starting Popup Hub at http://localhost:3000
node node_modules\next\dist\bin\next dev %*
