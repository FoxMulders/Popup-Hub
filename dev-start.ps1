# Popup Hub — local dev server with trusted HTTPS (mkcert + Next.js)
$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
Set-Location $ProjectRoot

# winget installs mkcert on PATH; refresh so this session can find it.
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')

if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
  Write-Host 'mkcert is not installed. Run: winget install FiloSottile.mkcert' -ForegroundColor Red
  exit 1
}

$certDir = Join-Path $ProjectRoot '.cert'
$keyFile = Join-Path $certDir 'localhost-key.pem'
$certFile = Join-Path $certDir 'localhost.pem'

Write-Host 'Installing mkcert local CA (approve the UAC prompt once for a green browser lock)...' -ForegroundColor Cyan
mkcert -install

if (-not (Test-Path $keyFile) -or -not (Test-Path $certFile)) {
  New-Item -ItemType Directory -Force -Path $certDir | Out-Null
  Write-Host 'Generating localhost TLS certificates...' -ForegroundColor Cyan
  mkcert -key-file $keyFile -cert-file $certFile localhost 127.0.0.1 ::1
}

Write-Host 'Starting Next.js at https://localhost:3000' -ForegroundColor Green
npm run dev
