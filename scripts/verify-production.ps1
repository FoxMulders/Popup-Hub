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
    @{ Path = '/check'; Name = 'Canopy trust directory' },
    @{ Path = '/for-organizers'; Name = 'For organizers' },
    @{ Path = '/manifest.json'; Name = 'PWA manifest' },
    @{ Path = '/sw.js'; Name = 'Service worker' },
    @{ Path = '/api/build-info'; Name = 'Build info API' },
    @{ Path = '/sitemap.xml'; Name = 'Sitemap' }
)

$trustOrganizerSlug = $env:PLAYWRIGHT_TRUST_ORGANIZER_SLUG
if (-not $trustOrganizerSlug) { $trustOrganizerSlug = 'lauderdale-community-league' }
$paths += @{ Path = "/organizers/$trustOrganizerSlug"; Name = 'Organizer trust report' }

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
    $primaryOrigin = $baseUrls[0]
    try {
        $buildParams = @{
            Uri = "$primaryOrigin/api/build-info"
            Method = 'Get'
            TimeoutSec = 30
            UseBasicParsing = $true
        }
        if ($primaryOrigin -match '^https://localhost') {
            $buildParams.SkipCertificateCheck = $true
        }
        $buildRaw = (Invoke-WebRequest @buildParams).Content
        $build = $buildRaw | ConvertFrom-Json
        $repoBuildPath = Join-Path $PSScriptRoot '..' 'build-number.json'
        $repoBuild = Get-Content $repoBuildPath -Raw | ConvertFrom-Json
        if ($build.buildNumber -lt 1) {
            Write-Host "  FAIL Build number invalid ($($build.buildNumber))" -ForegroundColor Red
            $failures++
        } elseif ($build.buildNumber -lt $repoBuild.build) {
            Write-Host "  WARN Production build $($build.buildNumber) behind repo build $($repoBuild.build)" -ForegroundColor Yellow
        } else {
            Write-Host "  OK   Build info v$($build.version) build $($build.buildNumber) commit $($build.commit)" -ForegroundColor Green
        }
    } catch {
        Write-Host "  FAIL Build info validation - $($_.Exception.Message)" -ForegroundColor Red
        $failures++
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
