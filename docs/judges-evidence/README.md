# Judges’ evidence images

Add screenshots here so **[`../judges-token-vault-proof.md`](../judges-token-vault-proof.md)** can display them.

**Expected filenames** (PNG or WebP):

1. `01-auth0-application-settings.png` — Auth0 Application callback URL including `.../functions/v1/auth0-token-vault?action=callback`
2. `02-auth0-social-connections.png` — GitHub / Google / Slack (or your demo connections) enabled in the Auth0 tenant
3. `03-supabase-function-deployed.png` — Supabase dashboard showing `auth0-token-vault` deployed
4. `04-app-connected-accounts.png` — Tether UI with at least one connected provider
5. `05-network-authorize-to-auth0.png` — DevTools network row showing redirect to your Auth0 `/authorize` URL

Do not commit secrets (client secrets, encryption keys, or JWTs). Crop or redact if needed.
