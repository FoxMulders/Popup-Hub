#!/usr/bin/env bash
# One-time setup + push all Supabase migrations for Popup Hub
#
# BEFORE RUNNING (one time):
#   1. Create an access token: https://supabase.com/dashboard/account/tokens
#   2. Get your database password: Supabase → Project Settings → Database
#
# RUN (Git Bash):
#   cd ~/Projects/popup-hub
#   export SUPABASE_ACCESS_TOKEN="your-token-here"
#   export SUPABASE_DB_PASSWORD="your-db-password-here"
#   bash scripts/setup-and-push-migrations.sh
#
# After the first successful run, you only need:
#   cd ~/Projects/popup-hub && npm run db:push

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="ensbggtbgabogvynqsqt"

cd "$PROJECT_DIR"
echo ""
echo "==> Popup Hub — Supabase migrations"
echo "    Project: $PROJECT_REF"
echo "    Directory: $PROJECT_DIR"
echo ""

if ! command -v npx >/dev/null 2>&1; then
  echo "ERROR: npx not found. Install Node.js and try again."
  exit 1
fi

# Login (skip if already logged in and token not set)
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "==> Logging in with SUPABASE_ACCESS_TOKEN..."
  npx supabase login --token "$SUPABASE_ACCESS_TOKEN"
elif [[ ! -f "$HOME/.supabase/access-token" ]] && [[ ! -f "$APPDATA/supabase/access-token" ]]; then
  echo "==> Not logged in. Run one of:"
  echo "    export SUPABASE_ACCESS_TOKEN=\"your-token\""
  echo "    npx supabase login"
  echo ""
  read -r -p "Press Enter after you have logged in (or set SUPABASE_ACCESS_TOKEN and re-run)..."
fi

# Link project if not linked
if [[ ! -f "$PROJECT_DIR/.supabase/linked" ]] && [[ ! -f "$PROJECT_DIR/supabase/.temp/project-ref" ]]; then
  echo "==> Linking project $PROJECT_REF..."
  if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
    npx supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
  else
    echo "    (You will be prompted for the database password)"
    npx supabase link --project-ref "$PROJECT_REF"
  fi
else
  echo "==> Project already linked (or link file present). Skipping link."
fi

echo ""
echo "==> Pushing migrations..."
npx supabase db push

echo ""
echo "==> Done. All pending migrations applied."
echo ""
echo "Optional: create storage bucket in Supabase Dashboard → Storage:"
echo "  - booth-clearance-photos (public)"
echo ""
