# Local smoke test matrix

Run with `npm run dev` (default **http://localhost:8080**). Ensure `.env` has required `VITE_*` values and Auth0 allows that origin for callback, logout, and web origins.

Edge Function URLs for MCP and agent use [`getEdgeFunctionUrl`](../src/lib/env.ts) (`VITE_SUPABASE_URL` + `/functions/v1/<name>`).

## Automated (no login)

| Check | Result |
|-------|--------|
| `npm run lint` | Pass (last run during plan implementation) |
| `npm run build` | Pass |

## Manual (logged in)

Mark each row after you run it.

| # | Area | What to verify | Pass |
|---|------|----------------|------|
| 1 | Auth | Login and logout | |
| 2 | Auth | Password reset (only if `VITE_AUTH0_DATABASE_CONNECTION` is set) | |
| 3 | Dashboard | Charts/stats load; nudges load or show a clear error | |
| 4 | Dashboard | Agent endpoint line matches `POST` + same host as Settings MCP URL (both from `getEdgeFunctionUrl`) | |
| 5 | New mission | Manifest generation succeeds or surfaces AI/Edge error | |
| 6 | Mission detail | Simulate allowed vs blocked action; execution log updates | |
| 7 | Mission detail | Step-up flow if mission requires GitHub/Google verification | |
| 8 | Ledger | List, export JSON, replay if applicable | |
| 9 | Accounts | Connect and disconnect a provider (Auth0 connections) | |
| 10 | Policy | Rules list; AI generate policy | |
| 11 | Settings | Toggle MCP / ambient; MCP Test Console: `initialize`, `tools/list`, `tools/call` | |
| 12 | Settings | Copied MCP URL equals `getEdgeFunctionUrl("mcp-server")` for your project | |
| 13 | Demo mode | Settings → enable **Demo mode** → redirects to dashboard; banner shows; manifest/nudges/policy AI are instant/scripted; simulate + MCP `tools/call` return mock provider results; turn off when done | |

## Demo mode (recordings)

Toggle under **Settings → Demo mode**. While on: Edge uses [`demo-fixtures`](../supabase/functions/_shared/demo-fixtures.ts) for manifest, policy, nudges; [`agent-action`](../supabase/functions/agent-action/index.ts) skips live provider HTTP after scope checks; [`step-up-status`](../supabase/functions/step-up-status/index.ts) returns synthetic verification. OAuth and mission/policy **blocking** stay real.

## External agent (optional)

`POST` to `getEdgeFunctionUrl("agent-action")` with headers:

- `Authorization: Bearer <Auth0 access token>`
- `apikey: <VITE_SUPABASE_PUBLISHABLE_KEY>`
- `Content-Type: application/json`

Body shape matches [`MissionDetail` simulate](../src/pages/MissionDetail.tsx) (`supabase.functions.invoke("agent-action", { body: { mission_id, action, params } })`).

## If something fails

- **401/403 on Edge:** Align `VITE_AUTH0_AUDIENCE` with Supabase secret `AUTH0_AUDIENCE` (or leave both unset for OIDC-only).
- **AI errors:** Check Supabase Edge secrets `AI_COMPAT_API_URL` / `AI_COMPAT_API_KEY`.
- **Token / provider actions:** `TOKEN_ENCRYPTION_KEY` and vault connect flow.
- **Empty data:** RLS and `user_id` on rows.
