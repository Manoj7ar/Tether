import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "https://esm.sh/jose@5.9.6";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function getAuth0Domain() {
  const rawDomain = Deno.env.get("AUTH0_DOMAIN");
  const normalized = rawDomain?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") ?? "";

  if (!normalized) {
    throw new AuthError("Server authentication is not configured", 503);
  }

  return normalized;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(domain: string) {
  const cached = jwksCache.get(domain);
  if (cached) {
    return cached;
  }

  const jwks = createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
  jwksCache.set(domain, jwks);
  return jwks;
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

  const domain = getAuth0Domain();
  const token = authHeader.slice("Bearer ".length);
  const audience = Deno.env.get("AUTH0_AUDIENCE")?.trim() || undefined;
  const issuer = `https://${domain}/`;
  const jwks = getJwks(domain);

  let payload: JWTPayload;
  try {
    if (audience) {
      try {
        ({ payload } = await jwtVerify(token, jwks, { audience, issuer }));
      } catch {
        // SPA may omit API audience while Edge has AUTH0_AUDIENCE set; issuer-only is still Auth0.
        ({ payload } = await jwtVerify(token, jwks, { issuer }));
      }
    } else {
      ({ payload } = await jwtVerify(token, jwks, { issuer }));
    }
  } catch {
    throw new AuthError("Invalid or expired session", 401);
  }

  if (!payload.sub) {
    throw new AuthError("Unauthorized");
  }

  return {
    claims: payload,
    token,
    userId: payload.sub,
  };
}
