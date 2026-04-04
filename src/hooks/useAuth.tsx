/**
 * Auth0 SPA session + profile. `user.id` is Auth0 `sub` — same id used in Postgres RLS and Edge JWT checks.
 * Supabase receives this token via `setSupabaseAccessTokenGetter`; do not use Supabase Auth for login.
 * @see docs/auth-supabase-data.md
 */
import type { GetTokenSilentlyOptions } from "@auth0/auth0-spa-js";
import {
  Auth0Provider,
  useAuth0,
  type AppState,
  type User as Auth0SdkUser,
} from "@auth0/auth0-react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { setSupabaseAccessTokenGetter } from "@/integrations/supabase/client";
import {
  getAppConfig,
  type AppConfig,
} from "@/lib/env";

export interface AuthUser {
  /** Best-effort email from Auth0 claims (requires `email` scope when the IdP supplies it). */
  email?: string;
  id: string;
  name?: string;
  nickname?: string;
  preferredUsername?: string;
  picture?: string;
  sub: string;
}

/** Single line for UI: real email when present, otherwise name / username / sub (never a fake placeholder). */
export function getAccountDisplayLabel(user: AuthUser | null | undefined): string {
  if (!user) return "Signed out";
  const email = user.email?.trim();
  if (email) return email;
  const name = user.name?.trim();
  if (name) return name;
  const nick = user.nickname?.trim();
  if (nick) return nick;
  const pref = user.preferredUsername?.trim();
  if (pref) return pref;
  if (user.sub) return user.sub;
  return "Signed in";
}

export function getAccountInitials(user: AuthUser | null | undefined): string {
  const label = getAccountDisplayLabel(user);
  if (label === "Signed out" || label === "Signed in") return "?";
  const at = label.indexOf("@");
  if (at > 0) {
    return label.slice(0, 2).toUpperCase();
  }
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || "?";
  }
  if (label.length >= 2) {
    return label.slice(0, 2).toUpperCase();
  }
  return label.slice(0, 1).toUpperCase() || "?";
}

interface LoginOptions {
  returnTo?: string;
  screenHint?: "signup";
}

interface AuthContextType {
  /** Pass `{ cacheMode: 'off' }` to force a refresh when Edge returns 401 / expired session. */
  getAccessToken: (options?: GetTokenSilentlyOptions) => Promise<string>;
  isAuthenticated: boolean;
  loading: boolean;
  login: (options?: LoginOptions) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  /** True when the Auth0 session can no longer silently refresh tokens. Show a banner. */
  sessionExpired: boolean;
  signOut: () => Promise<void>;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextType>({
  getAccessToken: async (_options?: GetTokenSilentlyOptions) => {
    throw new Error("Authentication is not configured");
  },
  isAuthenticated: false,
  loading: true,
  login: async () => {},
  resetPassword: async () => {},
  sessionExpired: false,
  signOut: async () => {},
  user: null,
});

function mapAuth0User(user: Auth0SdkUser | undefined): AuthUser | null {
  if (!user?.sub) return null;

  const preferredRaw = (user as { preferred_username?: string }).preferred_username;
  const preferredUsername =
    typeof preferredRaw === "string" && preferredRaw.trim() ? preferredRaw.trim() : undefined;

  let email = typeof user.email === "string" && user.email.trim() ? user.email.trim() : undefined;
  if (!email && typeof user.name === "string" && user.name.includes("@")) {
    email = user.name.trim();
  }
  if (!email && preferredUsername?.includes("@")) {
    email = preferredUsername;
  }

  return {
    email,
    id: user.sub,
    name: user.name,
    nickname: typeof user.nickname === "string" ? user.nickname : undefined,
    preferredUsername,
    picture: user.picture,
    sub: user.sub,
  };
}

function AuthBridge({
  children,
  config,
}: {
  children: ReactNode;
  config: AppConfig;
}) {
  const {
    error: auth0Error,
    getAccessTokenSilently,
    isAuthenticated: rawIsAuthenticated,
    isLoading: rawIsLoading,
    loginWithRedirect,
    logout,
    user: auth0User,
  } = useAuth0();

  const freshUser = useMemo(() => mapAuth0User(auth0User), [auth0User]);

  // Cache the last known good user so transient Auth0 drops don't null out queries
  const lastGoodUserRef = useRef<AuthUser | null>(null);
  if (freshUser) {
    lastGoodUserRef.current = freshUser;
  }

  const isRealLogout = useRef(false);

  // During transient drops, serve the cached user; only null on real logout
  const user = freshUser ?? (isRealLogout.current ? null : lastGoodUserRef.current);

  // Keep a stable ref so the Supabase getter always calls the latest SDK function.
  const getTokenRef = useRef(getAccessTokenSilently);
  getTokenRef.current = getAccessTokenSilently;

  // Resilient token getter: retries with cache off on login_required.
  // Never triggers loginWithRedirect — callers surface errors to the user
  // and the SessionExpiredBanner prompts a manual re-login.
  const resilientGetToken = useCallback(async (options?: GetTokenSilentlyOptions): Promise<string> => {
    try {
      return await getTokenRef.current(options ?? {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const isLoginErr = /login.required|login_required|consent.required/i.test(msg);

      if (isLoginErr && !options?.cacheMode) {
        try {
          return await getTokenRef.current({ cacheMode: "off" });
        } catch {
          throw err;
        }
      }
      throw err;
    }
  }, []);

  // Derive stable isAuthenticated / loading:
  const isAuthenticated = rawIsAuthenticated || (!!user && !isRealLogout.current);
  const isLoading = rawIsLoading && !user;

  // Detect persistent session expiry: Auth0 SDK dropped auth but we still
  // have a cached user from a previous successful login.
  const [sessionExpired, setSessionExpired] = useState(false);

  useLayoutEffect(() => {
    if (rawIsLoading) return;
    if (rawIsAuthenticated) {
      setSessionExpired(false);
      return;
    }
    if (!isRealLogout.current && lastGoodUserRef.current) {
      setSessionExpired(true);
    }
  }, [rawIsAuthenticated, rawIsLoading]);

  // Silent token getter for the Supabase client's accessToken callback.
  // Must never throw or redirect — Supabase calls it on every operation
  // (realtime, queries, etc.). Returns null on failure so requests proceed
  // anonymously; the explicit getAccessToken calls handle errors visibly.
  const silentGetToken = useCallback(async (): Promise<string | null> => {
    try {
      return await getTokenRef.current({});
    } catch {
      try {
        return await getTokenRef.current({ cacheMode: "off" });
      } catch {
        return null;
      }
    }
  }, []);

  useLayoutEffect(() => {
    if (isAuthenticated) {
      setSupabaseAccessTokenGetter(silentGetToken);
    } else if (!rawIsLoading) {
      setSupabaseAccessTokenGetter(null);
    }
  }, [isAuthenticated, rawIsLoading, silentGetToken]);

  useLayoutEffect(() => {
    return () => setSupabaseAccessTokenGetter(null);
  }, []);

  if (auth0Error) {
    console.warn("[Tether AuthBridge] Auth0 error:", auth0Error.message);
  }

  const value = useMemo<AuthContextType>(() => ({
    getAccessToken: resilientGetToken,
    isAuthenticated,
    loading: isLoading,
    login: async ({ returnTo, screenHint } = {}) => {
      await loginWithRedirect({
        appState: { returnTo },
        authorizationParams: {
          ...(screenHint ? { screen_hint: screenHint } : {}),
        },
      });
    },
    resetPassword: async (email: string) => {
      if (!config.auth0DatabaseConnection) {
        throw new Error("VITE_AUTH0_DATABASE_CONNECTION is required for password reset.");
      }

      const response = await fetch(`https://${config.auth0Domain}/dbconnections/change_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: config.auth0ClientId,
          connection: config.auth0DatabaseConnection,
          email,
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || "Password reset failed");
      }
    },
    sessionExpired,
    signOut: async () => {
      isRealLogout.current = true;
      lastGoodUserRef.current = null;
      setSessionExpired(false);
      await logout({
        logoutParams: {
          returnTo: window.location.origin,
        },
      });
    },
    user,
  }), [
    config.auth0ClientId,
    config.auth0DatabaseConnection,
    config.auth0Domain,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    resilientGetToken,
    sessionExpired,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Auth0ProviderWithRouter({ children }: { children: ReactNode }) {
  const config = getAppConfig();
  const navigate = useNavigate();
  const location = useLocation();

  const hasAudience = Boolean(config.auth0Audience);

  return (
    <Auth0Provider
      authorizationParams={{
        ...(hasAudience ? { audience: config.auth0Audience } : {}),
        redirect_uri: window.location.origin,
        ...(config.auth0Scope ? { scope: config.auth0Scope } : {}),
      }}
      cacheLocation="localstorage"
      clientId={config.auth0ClientId}
      domain={config.auth0Domain}
      onRedirectCallback={(appState?: AppState) => {
        const returnTo = appState?.returnTo;
        if (returnTo && returnTo !== "/auth") {
          navigate(returnTo, { replace: true });
          return;
        }
        const path = location.pathname;
        if (path && path !== "/auth" && path !== "/") {
          navigate(path, { replace: true });
          return;
        }
        navigate("/dashboard", { replace: true });
      }}
      useRefreshTokens
      useRefreshTokensFallback
    >
      <AuthBridge config={config}>{children}</AuthBridge>
    </Auth0Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <Auth0ProviderWithRouter>{children}</Auth0ProviderWithRouter>;
}
