#!/usr/bin/env bash
set -euo pipefail

# Automatic Supabase Database Migrations & Edge Functions Deployment Script
# Used by `npm run deploy:supabase`

PROJECT_ID="${SUPABASE_PROJECT_ID:-ovrjbuwfmfjcrhwmrrba}"

if command -v supabase >/dev/null 2>&1; then
  SUPA_CMD=(supabase)
elif command -v npx >/dev/null 2>&1; then
  SUPA_CMD=(npx --yes supabase@latest)
else
  echo "Error: Neither 'supabase' CLI nor 'npx' was found in PATH." >&2
  exit 1
fi

echo "========================================================"
echo "Payvora Automated Supabase Deployment ($PROJECT_ID)"
echo "========================================================"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Error: SUPABASE_ACCESS_TOKEN environment variable is required." >&2
  echo "Export it first: export SUPABASE_ACCESS_TOKEN=sbp_..." >&2
  exit 1
fi

if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  echo "Error: SUPABASE_DB_PASSWORD environment variable is required for 'supabase db push'." >&2
  echo "Export it first: export SUPABASE_DB_PASSWORD=..." >&2
  exit 1
fi

echo "1/3 Linking Supabase project $PROJECT_ID..."
echo "$SUPABASE_DB_PASSWORD" | "${SUPA_CMD[@]}" link --project-ref "$PROJECT_ID"

echo "2/3 Pushing SQL migrations (including 20260519, 20260520, 20260521)..."
"${SUPA_CMD[@]}" db push --remote --password "$SUPABASE_DB_PASSWORD" --include-all --yes

echo "3/3 Deploying all Edge Functions (including submit_task, auth, admin_api)..."
for dir in supabase/functions/*/; do
  func="$(basename "$dir")"
  if [ "$func" = "_shared" ]; then
    continue
  fi
  echo " -> Deploying Edge Function: $func"
  "${SUPA_CMD[@]}" functions deploy "$func" --project-ref "$PROJECT_ID" --yes --no-verify-jwt
done

echo "✅ Automatic Supabase migration & Edge Function deployment complete."
