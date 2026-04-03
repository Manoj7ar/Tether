#!/usr/bin/env bash
# Deploy all Edge Functions to the linked Supabase project (requires `supabase login` + `supabase link`).
# MCP deploy has payload limits; large functions are deployed reliably via the CLI.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FUNCS=(
  agent-action
  auth0-token-vault
  calculate-trust-score
  generate-manifest
  generate-nudges
  generate-policy
  mcp-server
  mission-approve
  step-up-complete
  step-up-status
  user-settings
)

for fn in "${FUNCS[@]}"; do
  echo "==> Deploying $fn"
  npx --yes supabase@latest functions deploy "$fn" --no-verify-jwt
done

echo "All functions deployed."
