# Auth0, Supabase, and where data lives

This app **does not use Supabase Auth**. Users sign in with **Auth0**; the SPA passes the **Auth0 access token** into the Supabase client so **Postgres RLS** and **Edge Functions** can identify the same person via JWT `sub`.

---

## Quick decision: who do I call?

| You need | Call / use | Why |
|----------|------------|-----|
| “Who is logged in?” display name, email, picture | **`useAuth()`** (`@auth0/auth0-react` via `AuthBridge`) | Identity and session come from Auth0 only. |
| A **Bearer token** for backend calls | **`getAccessToken()`** from **`useAuth()`** | Same JWT Edge Functions and RLS expect (`Authorization: Bearer …`). |
| **User settings** (MCP, ambient, demo mode, onboarding, `display_name`) | **`user-settings` Edge Function** — `useUserSettings` / `useUpdateUserSettings` in [`src/hooks/useUserSettings.ts`](../src/hooks/useUserSettings.ts) | Rows live in Postgres `user_settings`, but the SPA goes through this function (service role + consistent shape). **Do not** add random `supabase.from("user_settings")` on the client unless you intentionally change that pattern. |
| **Missions**, **execution_log** (read paths that hit RLS) | **`supabase.from(...)`** with the shared client | JWT is attached in [`src/integrations/supabase/client.ts`](../src/integrations/supabase/client.ts); RLS uses `requesting_sub()` = Auth0 `sub`. |
| **Realtime** (mission updates, notifications) | **`supabase.channel`** / removeChannel | Same Supabase project; auth is still the Auth0 JWT on the socket. |
| **AI** (manifest, policy, nudges) | **`generate-manifest`**, **`generate-policy`**, **`generate-nudges`** Edge Functions | JWT required. |
| **Tool execution / approval** | **`agent-action`**, **`mission-approve`** | JWT + mission context. |
| **Link GitHub / Gmail / Calendar / Slack** | **`auth0-token-vault`** (see [`useTokenVault`](../src/hooks/useTokenVault.ts)) | OAuth is **Auth0**; encrypted tokens are stored in Supabase **server-side** only. |

---

## Where things are stored

| Kind of data | Storage | Notes |
|--------------|---------|--------|
| Auth session (tokens, refresh) | **Auth0** + SDK cache (`localStorage` in this app) | Configured on `Auth0Provider` in `useAuth.tsx`. |
| `user_settings` | **Postgres** `public.user_settings` | Read/write for the SPA today = **`user-settings` Edge** only. |
| Missions, policies, ledger rows, nudges cache, etc. | **Postgres** | Access from client via **RLS**-safe queries or via Edge where implemented. |
| Connected account metadata | **Postgres** `connected_accounts` | Listed via token-vault / APIs that use service role or RLS as designed. |
| Provider access/refresh secrets | **Encrypted** store (e.g. `connected_account_secrets`) | **Never** in the browser; only Edge with service role. |
| AI provider keys, Auth0 client secret | **Supabase Edge secrets** | Never `VITE_*`. |
| Public app config | **`VITE_*` env** | Loaded through [`getAppConfig()`](../src/lib/env.ts). |

---

## Request flow (mental model)

1. User logs in → **Auth0** returns session + **access token** (JWT).
2. `AuthBridge` registers **`setSupabaseAccessTokenGetter`** so the Supabase client sends that JWT on Postgres and Realtime.
3. Anything that needs **trusted server logic** or **secrets** → **Edge Function** with `Authorization: Bearer <token>` (or `supabase.functions.invoke`, which uses the same client token).
4. **User id** in the database for RLS and joins is the Auth0 **`sub`** (string), not a Supabase `auth.users` uuid.

---

## Code map (start here when adding features)

| Area | File(s) |
|------|---------|
| Auth0 provider + context | [`src/hooks/useAuth.tsx`](../src/hooks/useAuth.tsx) |
| Supabase client + JWT wiring | [`src/integrations/supabase/client.ts`](../src/integrations/supabase/client.ts) |
| Env (Vite public config) | [`src/lib/env.ts`](../src/lib/env.ts) |
| User settings API | [`src/hooks/useUserSettings.ts`](../src/hooks/useUserSettings.ts), Edge [`supabase/functions/user-settings`](../supabase/functions/user-settings/index.ts) |
| Missions / counts / Realtime | [`src/hooks/useMissions.ts`](../src/hooks/useMissions.ts), related hooks |
| Token vault connect | [`src/hooks/useTokenVault.ts`](../src/hooks/useTokenVault.ts) |
| DB types | [`src/integrations/supabase/types.ts`](../src/integrations/supabase/types.ts) |

---

## Common mistakes to avoid

- **Using Supabase Auth** helpers (`signInWithPassword`, etc.) — not part of this stack.
- **Storing provider OAuth tokens in React state or localStorage** — use vault + Edge only.
- **Calling Postgres tables that have no RLS policy for the JWT** — will fail or leak; mirror existing patterns or update policies in SQL migrations.
- **Mixing Supabase projects** — `VITE_SUPABASE_URL` and Edge secrets must be the **same** project (see `getSupabaseFunctionsBaseUrl()`).

For the high-level diagram, see [README.md § Auth0-centric architecture](../README.md#auth0-centric-architecture).
