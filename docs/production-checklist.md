# Production Checklist

## Frontend runtime
- Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID`.
- Set `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, and `VITE_AUTH0_AUDIENCE`.
- Set `VITE_AUTH0_DATABASE_CONNECTION` if password reset should stay enabled.

## Supabase Edge Function secrets
- Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Set `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_AUDIENCE`.
- Set `AI_COMPAT_API_URL` and `AI_COMPAT_API_KEY` for generate-manifest / policy / nudges. Optionally set `AI_COMPAT_MODEL` to a model your provider accepts (default is `gpt-4o-mini`).

## Auth0 configuration
- Expose an API audience used for browser access tokens.
- Ensure access tokens sent to Supabase include `sub`.
- Ensure access tokens used against Supabase data APIs also include `role: authenticated` so RLS and Realtime resolve correctly.
- Keep Universal Login callback and logout URLs aligned with the deployed app origin.

## Deploy checks
- Apply migrations (includes `step_up_verifications` for high-risk step-up).
- Deploy the **`user-settings`** Edge Function (Settings page MCP / Ambient toggles call it with the Auth0 token).
- Verify login, mission creation, approval, connected-account link, MCP test console, and **step-up re-auth** (GitHub / Google) on a mission that includes `github.delete_repo` or `gmail.download_all` permissions. OAuth callback may redirect to a `returnPath` (same origin, path-only) so users land back on the mission or `/approve` after reauth.
- Verify Edge Functions reject missing or invalid bearer tokens.
- Confirm Supabase RLS still isolates records by Auth0 subject after migration.
