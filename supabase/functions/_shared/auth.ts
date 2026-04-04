import {
  createRemoteJWKSet,
  decodeJwt,
  jwtVerify,
  type JWTPayload,
} from "https://esm.sh/jose@5.9.6";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function normalizeAuth0Host(raw: string): string {
  return raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
}

function getAuth0Domain() {
  const rawDomain = Deno.env.get("AUTH0_DOMAIN");
  const normalized = normalizeAuth0Host(rawDomain ?? "");

  if (!normalized) {
    throw new AuthError("Server authentication is not configured", 503);
  }

  return normalized;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(host: string) {
  const cached = jwksCache.get(host);
  if (cached) {
    return cached;
  }

  const jwks = createRemoteJWKSet(new URL(`https://${host}/.well-known/jwks.json`));
  jwksCache.set(host, jwks);
  return jwks;
}

function issuerUrlsForEnv(): string[] {
  const domain = getAuth0Domain();
  const urls = new Set<string>();
  urls.add(`https://${domain}/`);

  const customRaw = Deno.env.get("AUTH0_CUSTOM_DOMAIN")?.trim() ?? "";
  if (customRaw) {
    const host = normalizeAuth0Host(customRaw);
    if (host && host !== domain) {
      urls.add(`https://${host}/`);
    }
  }
  return [...urls];
}

function normalizeIssuerUrl(iss: string): string {
  const trimmed = iss.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

async function jwtVerifyForIssuer(
  token: string,
  issuerUrl: string,
  audience: string | undefined,
): Promise<JWTPayload> {
  const issuer = normalizeIssuerUrl(issuerUrl);
  const host = new URL(issuer).hostname;
  const jwks = getJwks(host);

  if (audience) {
    try {
      return (await jwtVerify(token, jwks, { audience, issuer })).payload;
    } catch {
      return (await jwtVerify(token, jwks, { issuer })).payload;
    }
  }

  return (await jwtVerify(token, jwks, { issuer })).payload;
}

/** Try env-configured issuers, then token `iss` if its host matches allowed domains. */
async function verifyAuth0AccessToken(token: string): Promise<JWTPayload> {
  const audience = Deno.env.get("AUTH0_AUDIENCE")?.trim() || undefined;
  const domain = getAuth0Domain();
  const customRaw = Deno.env.get("AUTH0_CUSTOM_DOMAIN")?.trim() ?? "";
  const customHost = customRaw ? normalizeAuth0Host(customRaw) : "";

  const allowedHosts = new Set<string>([domain]);
  if (customHost) allowedHosts.add(customHost);

  let lastError: unknown;
  for (const issuerUrl of issuerUrlsForEnv()) {
    try {
      return await jwtVerifyForIssuer(token, issuerUrl, audience);
    } catch (e) {
      lastError = e;
    }
  }

  try {
    const claims = decodeJwt(token);
    const issRaw = typeof claims.iss === "string" ? claims.iss : "";
    if (issRaw) {
      const host = new URL(normalizeIssuerUrl(issRaw)).hostname;
      if (allowedHosts.has(host)) {
        return await jwtVerifyForIssuer(token, issRaw, audience);
      }
    }
  } catch {
    // not a JWT or decode failed — fall through to opaque token check
  }

  console.error("Auth0 JWT verification failed:", lastError);
  throw new AuthError("Invalid or expired session", 401);
}

/**
 * Validate an opaque Auth0 access token via the /userinfo endpoint.
 * Auth0 returns opaque tokens when no audience is specified; these cannot be
 * verified with jose — instead we call Auth0's /userinfo which validates the
 * token server-side and returns the user profile.
 */
async function validateOpaqueToken(token: string): Promise<{ sub: string }> {
  const domain = getAuth0Domain();

  const res = await fetch(`https://${domain}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Auth0 /userinfo failed:", res.status, body);
    throw new AuthError("Invalid or expired session", 401);
  }

  const profile = await res.json();
  if (!profile.sub) {
    throw new AuthError("Auth0 /userinfo did not return a sub claim", 401);
  }

  return { sub: profile.sub as string };
}

function looksLikeJwt(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export async function requireAuth0User(req: Request): Promise<{
  claims: JWTPayload;
  token: string;
  userId: string;
}> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Unauthorized");
  }

  const token = authHeader.slice("Bearer ".length);

  if (looksLikeJwt(token)) {
    try {
      const payload = await verifyAuth0AccessToken(token);
      if (!payload.sub) {
        throw new AuthError("Unauthorized");
      }
      return { claims: payload, token, userId: payload.sub };
    } catch (e) {
      // If JWT verification fails, try opaque validation as fallback
      // (some Auth0 configs issue JWTs that don't match expected issuer/audience)
      console.warn("JWT verification failed, trying /userinfo fallback:", e instanceof Error ? e.message : e);
    }
  }

  // Opaque token path (no audience configured, or JWT verify failed)
  const { sub } = await validateOpaqueToken(token);
  return {
    claims: { sub } as JWTPayload,
    token,
    userId: sub,
  };
}
