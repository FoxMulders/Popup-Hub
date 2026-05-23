# push-migrations.ps1
# Pushes all pending Supabase migrations to the linked remote project.
#
# Usage:
#   .\scripts\push-migrations.ps1
#
# Prerequisites:
#   1. Obtain your Supabase access token from:
#      https://supabase.com/dashboard/account/tokens
#   2. Run once to log in:
#      npx supabase login
#      (paste your access token when prompted)
#   3. Link this project (only needed once):
#      npx supabase link --project-ref ensbggtbgabogvynqsqt
#      (enter your database password when prompted)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==> Pushing migrations to Supabase project: ensbggtbgabogvynqsqt" -ForegroundColor Cyan

try {
    npx supabase db push
    Write-Host ""
    Write-Host "==> Migrations pushed successfully!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "==> Migration push failed. Check the error above." -ForegroundColor Red
    Write-Host ""
    Write-Host "If you see an auth error, run: npx supabase login" -ForegroundColor Yellow
    Write-Host "If you see a 'not linked' error, run: npx supabase link --project-ref ensbggtbgabogvynqsqt" -ForegroundColor Yellow
    exit 1
}
