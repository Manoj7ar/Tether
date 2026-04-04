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
  const user = useMemo(() => mapAuth0User(auth0User), [auth0User]);

  // Track whether we were ever authenticated in this browser tab.
  // Auth0 can flip isAuthenticated to false during silent token renewal (ITP, popup blockers, etc.)
  // and we must NOT treat that as "logged out" — it's a transient state.
  const [wasAuthenticated, setWasAuthenticated] = useState(false);
  if (rawIsAuthenticated && !wasAuthenticated) {
    setWasAuthenticated(true);
  }

  // If Auth0 SDK says loading is done but isAuthenticated is false while
  // we were previously authed, keep reporting "loading" to prevent route guards from
  // kicking the user to /auth. Only clear once we detect a real logout (explicit signOut)
  // or an unrecoverable Auth0 error.
  const isRealLogout = useRef(false);

  const isTransientDrop = !rawIsLoading && !rawIsAuthenticated && wasAuthenticated && !isRealLogout.current;

  const isAuthenticated = rawIsAuthenticated || isTransientDrop;
  const isLoading = rawIsLoading || isTransientDrop;

  // Keep a stable ref so the Supabase getter always calls the latest SDK function.
  const getTokenRef = useRef(getAccessTokenSilently);
  getTokenRef.current = getAccessTokenSilently;

  // Resilient token getter: if the normal call throws login_required, retry with cache off
  // before giving up. This prevents a single silent-refresh failure from nuking the session.
  const resilientGetToken = useCallback(async (options?: GetTokenSilentlyOptions): Promise<string> => {
    try {
      return await getTokenRef.current(options ?? {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/login.required|login_required|consent.required/i.test(msg) && !options?.cacheMode) {
        return getTokenRef.current({ cacheMode: "off" });
      }
      throw err;
    }
  }, []);

  // Always keep the Supabase JWT getter registered while we consider the user authenticated.
  // Only null it out on real logout or unmount.
  useLayoutEffect(() => {
    if (isAuthenticated) {
      setSupabaseAccessTokenGetter(() => resilientGetToken());
    } else if (!rawIsLoading) {
      setSupabaseAccessTokenGetter(null);
    }
  }, [isAuthenticated, rawIsLoading, resilientGetToken]);

  useLayoutEffect(() => {
    return () => setSupabaseAccessTokenGetter(null);
  }, []);

  // If Auth0 gives us an actual error (not just transient), log it but don't auto-redirect.
  // The user can click "Continue with Auth0" on the auth page to resolve it.
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
    signOut: async () => {
      isRealLogout.current = true;
      setWasAuthenticated(false);
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
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Auth0ProviderWithRouter({ children }: { children: ReactNode }) {
  const config = getAppConfig();
  const navigate = useNavigate();
  const location = useLocation();

  const hasAudience = Boolean(config.auth0Audience);
  const scope = hasAudience
    ? config.auth0Scope
    : config.auth0Scope?.replace(/\boffline_access\b/g, "").replace(/\s+/g, " ").trim();

  return (
    <Auth0Provider
      authorizationParams={{
        ...(hasAudience ? { audience: config.auth0Audience } : {}),
        redirect_uri: window.location.origin,
        ...(scope ? { scope } : {}),
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
      useRefreshTokens={hasAudience}
    >
      <AuthBridge config={config}>{children}</AuthBridge>
    </Auth0Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <Auth0ProviderWithRouter>{children}</Auth0ProviderWithRouter>;
}
