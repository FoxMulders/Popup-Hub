# verify-production.ps1
# Quick HTTP smoke checks against production (or override with -BaseUrl).

param(
    [string]$BaseUrl = '',
    [switch]$VercelOnly
)

$ErrorActionPreference = 'Continue'

$baseUrls = if ($BaseUrl) {
    @($BaseUrl.TrimEnd('/'))
} elseif ($VercelOnly) {
    @('https://popup-hub.vercel.app')
} else {
    @('https://popuphub.ca', 'https://popup-hub.vercel.app')
}

$paths = @(
    @{ Path = '/'; Name = 'Landing' },
    @{ Path = '/login'; Name = 'Login' },
    @{ Path = '/signup'; Name = 'Signup' },
    @{ Path = '/discover'; Name = 'Discover' },
    @{ Path = '/manifest.json'; Name = 'PWA manifest' },
    @{ Path = '/sw.js'; Name = 'Service worker' },
    @{ Path = '/api/build-info'; Name = 'Build info API' },
    @{ Path = '/sitemap.xml'; Name = 'Sitemap' }
)

$eventId = $env:PLAYWRIGHT_SMOKE_EVENT_ID
if ($eventId) {
    $paths += @(
        @{ Path = "/events/$eventId"; Name = 'Event detail' },
        @{ Path = "/events/$eventId/map"; Name = 'Event floor plan' }
    )
}

$failures = 0

foreach ($origin in $baseUrls) {
    Write-Host ""
    Write-Host "==> Production smoke check: $origin" -ForegroundColor Cyan
    Write-Host ""

    $useCurlForTls = $origin -match '^https://localhost' -and $PSVersionTable.PSVersion.Major -lt 7

    foreach ($item in $paths) {
        $url = "$origin$($item.Path)"
        try {
            if ($useCurlForTls) {
                $statusText = curl.exe -k -s -o NUL -w "%{http_code}" $url
                $status = [int]$statusText
                if ($status -ge 200 -and $status -lt 400) {
                    Write-Host "  OK   $($item.Name) ($status) $url" -ForegroundColor Green
                } else {
                    Write-Host "  FAIL $($item.Name) ($status) $url" -ForegroundColor Red
                    $failures++
                }
                continue
            }

            $params = @{
                Uri = $url
                Method = 'Get'
                MaximumRedirection = 5
                TimeoutSec = 30
                UseBasicParsing = $true
            }
            if ($origin -match '^https://localhost') {
                $params.SkipCertificateCheck = $true
            }
            $response = Invoke-WebRequest @params
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
}

Write-Host ""
if ($failures -eq 0) {
    Write-Host "==> All checks passed." -ForegroundColor Green
    exit 0
} else {
    Write-Host "==> $failures check(s) failed. See docs/PRODUCTION_NEXT_STEPS.md (env vars, migrations)." -ForegroundColor Red
    exit 1
}
