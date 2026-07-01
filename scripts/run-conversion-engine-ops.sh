#!/usr/bin/env bash
# Run all Conversion Engine ops: migration, seed, verify, Vercel prod deploy.
#
# Prerequisites (.env.local or exported env):
#   SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD
#   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#   VERCEL_TOKEN (optional VERCEL_ORG_ID, VERCEL_PROJECT_ID)
#
# Usage:
#   bash scripts/run-conversion-engine-ops.sh
#   CONVERSION_ENGINE_EVENT_NAME="My Market" bash scripts/run-conversion-engine-ops.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="ensbggtbgabogvynqsqt"
cd "$PROJECT_DIR"

load_env_local() {
  if [[ ! -f .env.local ]]; then
    return 0
  fi
  set -a
  # shellcheck disable=SC1091
  source <(grep -v '^\s*#' .env.local | grep -v '^\s*$' | sed 's/\r$//')
  set +a
}

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: Missing $name (set in .env.local or export before running)" >&2
    exit 1
  fi
}

echo "==> Conversion Engine ops"
load_env_local

echo "==> Supabase login + link"
require_var SUPABASE_ACCESS_TOKEN
require_var SUPABASE_DB_PASSWORD
npx supabase login --token "$SUPABASE_ACCESS_TOKEN"
if [[ ! -f supabase/.temp/project-ref ]]; then
  npx supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
fi

echo "==> Push migrations"
npm run db:push

echo "==> Seed external listing test market"
require_var NEXT_PUBLIC_SUPABASE_URL
require_var SUPABASE_SERVICE_ROLE_KEY
SEED_OUTPUT="$(npx tsx scripts/seed-external-listing-market.ts)"
echo "$SEED_OUTPUT"
EVENT_ID="$(echo "$SEED_OUTPUT" | sed -n 's/^EVENT_ID=//p' | tail -1)"
if [[ -z "$EVENT_ID" ]]; then
  echo "ERROR: seed script did not emit EVENT_ID" >&2
  exit 1
fi
export CONVERSION_ENGINE_EVENT_ID="$EVENT_ID"

echo "==> Verify (local)"
npx tsx scripts/verify-conversion-engine.ts

echo "==> Deploy Vercel production"
require_var VERCEL_TOKEN
npx vercel deploy --prod --yes --token "$VERCEL_TOKEN"

echo "==> Verify (live API)"
export CONVERSION_ENGINE_BASE_URL="${CONVERSION_ENGINE_BASE_URL:-https://popuphub.ca}"
npx tsx scripts/verify-conversion-engine.ts --live

echo ""
echo "Done."
echo "  Event ID: $EVENT_ID"
echo "  Studio:   https://popuphub.ca/coordinator/studio?event=$EVENT_ID"
