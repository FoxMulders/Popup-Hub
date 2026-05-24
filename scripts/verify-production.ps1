# verify-production.ps1
# Quick HTTP smoke checks against production (or override with -BaseUrl).

param(
    [string]$BaseUrl = 'https://popup-hub.vercel.app'
)

$ErrorActionPreference = 'Continue'
$BaseUrl = $BaseUrl.TrimEnd('/')

$paths = @(
    @{ Path = '/'; Name = 'Landing' },
    @{ Path = '/login'; Name = 'Login' },
    @{ Path = '/signup'; Name = 'Signup' },
    @{ Path = '/discover'; Name = 'Discover' }
)

Write-Host ""
Write-Host "==> Production smoke check: $BaseUrl" -ForegroundColor Cyan
Write-Host ""

$failures = 0
foreach ($item in $paths) {
    $url = "$BaseUrl$($item.Path)"
    try {
        $response = Invoke-WebRequest -Uri $url -Method Get -MaximumRedirection 5 -TimeoutSec 30 -UseBasicParsing
        $status = $response.StatusCode
        if ($status -ge 200 -and $status -lt 400) {
            Write-Host "  OK   $($item.Name) ($status) $url" -ForegroundColor Green
        } else {
            Write-Host "  FAIL $($item.Name) ($status) $url" -ForegroundColor Red
            $failures++
        }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -ge 200 -and $code -lt 400) {
            Write-Host "  OK   $($item.Name) ($code) $url" -ForegroundColor Green
        } else {
            Write-Host "  FAIL $($item.Name) $url - $($_.Exception.Message)" -ForegroundColor Red
            $failures++
        }
    }
}

Write-Host ""
if ($failures -eq 0) {
    Write-Host "==> All checks passed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "==> $failures check(s) failed. See docs/PRODUCTION_NEXT_STEPS.md (env vars, migrations)." -ForegroundColor Red
    exit 1
}
