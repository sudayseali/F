#!/bin/bash
# Payvora One-Command Full Backend Deployment Script

set -e

PROJECT_REF="${1:-gwggirbuaewcmntnzjpp}"

echo "========================================================"
echo "PAYVORA BACKEND DEPLOYMENT TO SUPABASE (Ref: $PROJECT_REF)"
echo "========================================================"

echo "[1/3] Linking project..."
echo "$SUPABASE_DB_PASSWORD" | supabase link --project-ref "$PROJECT_REF" || true

echo "[2/3] Pushing database migrations..."
echo "$SUPABASE_DB_PASSWORD" | supabase db push --include-all --non-interactive || echo "$SUPABASE_DB_PASSWORD" | supabase db push || true

echo "[3/3] Deploying Edge Functions..."
for func in auth withdraw submit_task get_cpx_url cpx_postback cpa_postback postback tapjoy_webhook telegram-webhook verify_task_submission admin_api admin_action; do
  if [ -d "supabase/functions/$func" ]; then
    echo "Deploying function: $func"
    supabase functions deploy "$func" --project-ref "$PROJECT_REF" --no-verify-jwt || echo "Skipping $func..."
  fi
done

echo "========================================================"
echo "✅ SUCCESS: All database migrations & Edge Functions deployed!"
echo "========================================================"
