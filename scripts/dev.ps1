# Start Popup Hub dev server (works when PowerShell blocks npm.ps1)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "Starting Next.js on http://localhost:3000 ..." -ForegroundColor Cyan
& node "$ProjectRoot/node_modules/next/dist/bin/next" dev @args
