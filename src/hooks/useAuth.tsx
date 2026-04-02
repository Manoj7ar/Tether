import {
  Auth0Provider,
  useAuth0,
  type AppState,
  type User as Auth0SdkUser,
} from "@auth0/auth0-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { setSupabaseAccessTokenGetter } from "@/integrations/supabase/client";
import {
  getAppConfig,
  isStubAuthMode,
  type AppConfig,
} from "@/lib/env";

export interface AuthUser {
  email?: string;
  id: string;
  name?: string;
  picture?: string;
  sub: string;
}

interface LoginOptions {
  returnTo?: string;
  screenHint?: "signup";
}

interface AuthContextType {
  getAccessToken: () => Promise<string>;
  isAuthenticated: boolean;
  loading: boolean;
  login: (options?: LoginOptions) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextType>({
  getAccessToken: async () => {
    throw new Error("Authentication is not configured");
  },
  isAuthenticated: false,
  loading: true,
  login: async () => {},
  resetPassword: async () => {},
  signOut: async () => {},
  user: null,
});

const STUB_AUTH_STORAGE_KEY = "tether:e2e-auth-user";
const DEFAULT_STUB_TOKEN = "e2e-auth-token";

function mapAuth0User(user: Auth0SdkUser | undefined): AuthUser | null {
  if (!user?.sub) return null;

  return {
    email: user.email,
    id: user.sub,
    name: user.name,
    picture: user.picture,
    sub: user.sub,
  };
}

function StubAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;

    const raw = window.localStorage.getItem(STUB_AUTH_STORAGE_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });
  const navigate = useNavigate();

  useEffect(() => {
    setSupabaseAccessTokenGetter(user ? async () => DEFAULT_STUB_TOKEN : null);
  }, [user]);

  const value = useMemo<AuthContextType>(() => ({
    getAccessToken: async () => DEFAULT_STUB_TOKEN,
    isAuthenticated: !!user,
    loading: false,
    login: async ({ returnTo } = {}) => {
      const stubUser: AuthUser = {
        email: "operator@tether.test",
        id: "auth0|e2e-operator",
        name: "E2E Operator",
        sub: "auth0|e2e-operator",
      };
      window.localStorage.setItem(STUB_AUTH_STORAGE_KEY, JSON.stringify(stubUser));
      setUser(stubUser);
      navigate(returnTo || "/dashboard", { replace: true });
    },
    resetPassword: async () => {},
    signOut: async () => {
      window.localStorage.removeItem(STUB_AUTH_STORAGE_KEY);
      setUser(null);
    },
    user,
  }), [navigate, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AuthBridge({
  children,
  config,
}: {
  children: ReactNode;
  config: AppConfig;
}) {
  const {
    getAccessTokenSilently,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user: auth0User,
  } = useAuth0();
  const user = useMemo(() => mapAuth0User(auth0User), [auth0User]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSupabaseAccessTokenGetter(null);
      return;
    }

    setSupabaseAccessTokenGetter(async () => {
      return getAccessTokenSilently();
    });
  }, [getAccessTokenSilently, isAuthenticated]);

  const value = useMemo<AuthContextType>(() => ({
    getAccessToken: async () => getAccessTokenSilently(),
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
    getAccessTokenSilently,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Auth0ProviderWithRouter({ children }: { children: ReactNode }) {
  const config = getAppConfig();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Auth0Provider
      authorizationParams={{
        audience: config.auth0Audience,
        redirect_uri: window.location.origin,
        scope: config.auth0Scope,
      }}
      cacheLocation="localstorage"
      clientId={config.auth0ClientId}
      domain={config.auth0Domain}
      onRedirectCallback={(appState?: AppState) => {
        navigate(appState?.returnTo || location.pathname || "/dashboard", { replace: true });
      }}
      useRefreshTokens
    >
      <AuthBridge config={config}>{children}</AuthBridge>
    </Auth0Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  if (isStubAuthMode()) {
    return <StubAuthProvider>{children}</StubAuthProvider>;
  }

  return <Auth0ProviderWithRouter>{children}</Auth0ProviderWithRouter>;
}
