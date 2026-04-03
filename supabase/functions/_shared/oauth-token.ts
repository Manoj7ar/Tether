import { decryptSecret, encryptSecret } from "./crypto.ts";
import { requireEnv } from "./env.ts";

const EXPIRY_SKEW_MS = 120_000;

function normalizeAuth0Domain(): string | null {
  const raw = Deno.env.get("AUTH0_DOMAIN");
  const normalized = raw?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") ?? "";
  return normalized.length > 0 ? normalized : null;
}

export interface TokenRow {
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
}

export interface FreshAccessTokenResult {
  accessToken: string;
  /** If set, persist these columns on `connected_account_secrets` for this account. */
  persisted?: {
    access_token_encrypted: string;
    refresh_token_encrypted?: string | null;
    token_expires_at: string | null;
  };
}

/**
 * Returns a usable access token; refreshes via Auth0 when expiry is near and a refresh token exists.
 * On refresh failure, returns the existing access token (caller may still get 401 from the provider).
 */
export async function ensureFreshProviderAccessToken(row: TokenRow): Promise<FreshAccessTokenResult> {
  const accessToken = await decryptSecret(row.access_token_encrypted);
  if (!accessToken) {
    throw new Error("Access token is missing");
  }

  const refreshPlain = await decryptSecret(row.refresh_token_encrypted);
  const expiresMs = row.token_expires_at ? new Date(row.token_expires_at).getTime() : null;
  const now = Date.now();
  const shouldRefresh =
    !!refreshPlain &&
    expiresMs !== null &&
    !Number.isNaN(expiresMs) &&
    expiresMs - EXPIRY_SKEW_MS <= now;

  if (!shouldRefresh) {
    return { accessToken };
  }

  const domain = normalizeAuth0Domain();
  if (!domain) {
    return { accessToken };
  }

  let clientId: string;
  let clientSecret: string;
  try {
    clientId = requireEnv("AUTH0_CLIENT_ID");
    clientSecret = requireEnv("AUTH0_CLIENT_SECRET");
  } catch {
    return { accessToken };
  }

  const tokenRes = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshPlain,
    }),
  });

  if (!tokenRes.ok) {
    return { accessToken };
  }

  const tokens = await tokenRes.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokens.access_token) {
    return { accessToken };
  }

  const access_token_encrypted = await encryptSecret(tokens.access_token);
  const token_expires_at =
    typeof tokens.expires_in === "number"
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

  const persisted: FreshAccessTokenResult["persisted"] = {
    access_token_encrypted,
    token_expires_at,
  };

  if (typeof tokens.refresh_token === "string" && tokens.refresh_token.length > 0) {
    persisted.refresh_token_encrypted = await encryptSecret(tokens.refresh_token);
  }

  return {
    accessToken: tokens.access_token,
    persisted,
  };
}
