import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AuthError, requireAuth0User } from "../_shared/auth.ts";
import { encryptSecret } from "../_shared/crypto.ts";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SupportedProvider = "GitHub" | "Gmail" | "Google Calendar" | "Slack";

interface Auth0UserIdentity {
  access_token?: string;
  connection?: string;
  provider?: string;
  refresh_token?: string;
  user_id?: string;
}

interface Auth0UserProfile {
  email?: string;
  identities?: Auth0UserIdentity[];
  name?: string;
  nickname?: string;
  user_id: string;
}

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAuth0Domain() {
  const rawDomain = Deno.env.get("AUTH0_DOMAIN");
  return rawDomain?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") ?? "";
}

function getProviderConnection(provider: SupportedProvider) {
  const connectionMap: Record<SupportedProvider, string> = {
    GitHub: "github",
    Gmail: "google-oauth2",
    "Google Calendar": "google-oauth2",
    Slack: "slack",
  };

  return connectionMap[provider];
}

function getProviderScopes(provider: SupportedProvider) {
  const scopeMap: Record<SupportedProvider, string> = {
    GitHub: "openid profile email read:user repo delete_repo",
    Gmail: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
    ].join(" "),
    "Google Calendar": [
      "openid",
      "profile",
      "email",
      "offline_access",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" "),
    Slack: "openid profile email channels:read channels:history chat:write",
  };

  return scopeMap[provider];
}

async function getManagementToken(): Promise<string> {
  const domain = getAuth0Domain();
  const clientId = Deno.env.get("AUTH0_CLIENT_ID");
  const clientSecret = Deno.env.get("AUTH0_CLIENT_SECRET");

  if (!domain || !clientId || !clientSecret) {
    throw new Error("Auth0 credentials not configured");
  }

  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Auth0 management token request failed with ${res.status}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

async function authenticateUser(req: Request): Promise<string> {
  const { userId } = await requireAuth0User(req);
  return userId;
}

async function getProviderIdentity(
  auth0UserId: string,
  provider: SupportedProvider,
  managementToken: string,
): Promise<Auth0UserIdentity | null> {
  const domain = getAuth0Domain();
  const response = await fetch(
    `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}?fields=user_id,email,name,nickname,identities&include_fields=true`,
    {
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Auth0 profile lookup failed with ${response.status}`);
  }

  const profile = await response.json() as Auth0UserProfile;
  const connection = getProviderConnection(provider);
  return profile.identities?.find((identity) => {
    return identity.connection === connection || identity.provider === connection;
  }) ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const domain = getAuth0Domain();
    const clientId = requireEnv("AUTH0_CLIENT_ID");
    const clientSecret = requireEnv("AUTH0_CLIENT_SECRET");

    if (!domain || !clientId || !clientSecret) {
      throw new Error("Auth0 credentials not configured");
    }

    const supabaseAdmin = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    if (action === "callback") {
      const code = url.searchParams.get("code");
      const stateRaw = url.searchParams.get("state");
      if (!code || !stateRaw) {
        return jsonResponse({ error: "Missing code or state" }, 400);
      }

      const state = JSON.parse(stateRaw) as {
        appOrigin: string;
        provider: SupportedProvider;
        userId: string;
        returnPath?: string;
      };

      const redirectUri = `${requireEnv("SUPABASE_URL")}/functions/v1/auth0-token-vault?action=callback`;
      const tokenRes = await fetch(`https://${domain}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        throw new Error(`Token exchange failed [${tokenRes.status}]: ${body}`);
      }

      const auth0Tokens = await tokenRes.json() as {
        access_token: string;
        expires_in?: number;
        id_token?: string;
        refresh_token?: string;
        scope?: string;
        token_type?: string;
      };

      const userInfoRes = await fetch(`https://${domain}/userinfo`, {
        headers: { Authorization: `Bearer ${auth0Tokens.access_token}` },
      });
      if (!userInfoRes.ok) {
        throw new Error(`Auth0 userinfo failed with ${userInfoRes.status}`);
      }

      const userInfo = await userInfoRes.json() as { email?: string; name?: string; nickname?: string; sub: string };
      const managementToken = await getManagementToken();
      const identity = await getProviderIdentity(userInfo.sub, state.provider, managementToken);

      const providerAccessToken = identity?.access_token ?? auth0Tokens.access_token;
      const providerRefreshToken = identity?.refresh_token ?? auth0Tokens.refresh_token ?? null;

      if (!providerAccessToken) {
        throw new Error(`No provider access token available for ${state.provider}`);
      }

      const accessTokenEncrypted = await encryptSecret(providerAccessToken);
      const refreshTokenEncrypted = providerRefreshToken ? await encryptSecret(providerRefreshToken) : null;
      const scopeList = Array.from(
        new Set(
          [
            ...(auth0Tokens.scope ? auth0Tokens.scope.split(" ").filter(Boolean) : []),
            ...getProviderScopes(state.provider).split(" ").filter(Boolean),
          ],
        ),
      );

      const { data: account, error: upsertError } = await supabaseAdmin
        .from("connected_accounts")
        .upsert(
          {
            user_id: state.userId,
            provider: state.provider,
            provider_username: userInfo.email || userInfo.nickname || userInfo.name || null,
            scopes: scopeList,
            is_active: true,
            connected_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider", ignoreDuplicates: false },
        )
        .select("id")
        .single();

      if (upsertError) {
        throw upsertError;
      }

      const { error: secretError } = await supabaseAdmin
        .from("connected_account_secrets")
        .upsert({
          account_id: account.id,
          auth0_user_id: userInfo.sub,
          provider_user_id: identity?.user_id ?? null,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_type: auth0Tokens.token_type ?? "Bearer",
          token_expires_at: auth0Tokens.expires_in
            ? new Date(Date.now() + auth0Tokens.expires_in * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "account_id" });

      if (secretError) {
        throw secretError;
      }

      const safeReturn =
        typeof state.returnPath === "string" &&
        state.returnPath.startsWith("/") &&
        !state.returnPath.startsWith("//")
          ? state.returnPath
          : null;
      const location = safeReturn
        ? `${state.appOrigin.replace(/\/$/, "")}${safeReturn}`
        : `${state.appOrigin}/accounts?connected=${encodeURIComponent(state.provider)}`;

      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: location,
        },
      });
    }

    const userId = await authenticateUser(req);

    switch (action) {
      case "list": {
        const { data, error } = await supabaseAdmin
          .from("connected_accounts")
          .select("*")
          .eq("user_id", userId)
          .order("connected_at", { ascending: false });

        if (error) {
          throw error;
        }

        return jsonResponse({ accounts: data ?? [] });
      }

      case "connect":
      case "reauth": {
        const { provider, returnPath } = await req.json() as {
          provider?: SupportedProvider;
          returnPath?: string;
        };
        if (!provider) {
          return jsonResponse({ error: "provider is required" }, 400);
        }

        const redirectUri = `${requireEnv("SUPABASE_URL")}/functions/v1/auth0-token-vault?action=callback`;
        const authorizeUrl = new URL(`https://${domain}/authorize`);
        const appOrigin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || "";

        const safePath =
          typeof returnPath === "string" && returnPath.startsWith("/") && !returnPath.startsWith("//")
            ? returnPath
            : undefined;

        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("client_id", clientId);
        authorizeUrl.searchParams.set("redirect_uri", redirectUri);
        authorizeUrl.searchParams.set("scope", getProviderScopes(provider));
        authorizeUrl.searchParams.set("connection", getProviderConnection(provider));
        authorizeUrl.searchParams.set(
          "state",
          JSON.stringify({ appOrigin, provider, userId, returnPath: safePath }),
        );

        if (action === "reauth") {
          authorizeUrl.searchParams.set("prompt", "consent");
        }

        return jsonResponse({ authorizeUrl: authorizeUrl.toString() });
      }

      case "disconnect": {
        const { accountId } = await req.json() as { accountId?: string };
        if (!accountId) {
          return jsonResponse({ error: "accountId is required" }, 400);
        }

        await supabaseAdmin.from("connected_account_secrets").delete().eq("account_id", accountId);

        const { error } = await supabaseAdmin
          .from("connected_accounts")
          .delete()
          .eq("id", accountId)
          .eq("user_id", userId);

        if (error) {
          throw error;
        }

        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: "Invalid action" }, 400);
    }
  } catch (error) {
    console.error("auth0-token-vault error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof AuthError || message === "Unauthorized" ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
