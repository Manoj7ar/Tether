/**
 * App preferences and onboarding flags live in Postgres `user_settings`; this hook uses the `user-settings` Edge API only (not direct `from()`).
 * @see docs/auth-supabase-data.md
 */
import type { GetTokenSilentlyOptions } from "@auth0/auth0-spa-js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { edgeFunctionErrorMessage } from "@/lib/supabase-functions";

/** Auth0 silent token + Edge cold start can stall; never leave queries hanging without a bound. */
const ACCESS_TOKEN_TIMEOUT_MS = 20_000;
const USER_SETTINGS_FN_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId!));
}

export interface UserSettings {
  id: string;
  user_id: string;
  demo_mode: boolean;
  mcp_enabled: boolean;
  ambient_enabled: boolean;
  ambient_budget_max: number;
  ambient_budget_used: number;
  ambient_budget_window_start: string;
  ambient_allowed_actions: string[];
  display_name: string | null;
  onboarding_completed: boolean;
}

/** Used when the Edge function fails so the Settings UI (including demo mode) still renders. */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: "",
  user_id: "",
  demo_mode: false,
  mcp_enabled: false,
  ambient_enabled: false,
  ambient_budget_max: 50,
  ambient_budget_used: 0,
  ambient_budget_window_start: new Date().toISOString(),
  ambient_allowed_actions: [],
  display_name: null,
  onboarding_completed: true,
};

function isAuthLikeInvokeFailure(error: unknown, message: string): boolean {
  if (/invalid or expired session|unauthorized/i.test(message)) return true;
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    return error.context.status === 401;
  }
  return false;
}

/** One retry with a fresh Auth0 access token when Edge rejects the cached token. */
async function invokeUserSettings(
  getAccessToken: (options?: GetTokenSilentlyOptions) => Promise<string>,
  opts: { method: "GET" | "POST"; body?: object },
): Promise<unknown> {
  const run = async (forceRefresh: boolean) => {
    const token = await withTimeout(
      getAccessToken(forceRefresh ? { cacheMode: "off" } : {}),
      ACCESS_TOKEN_TIMEOUT_MS,
      "Could not refresh your session in time. Try signing out and back in.",
    );
    return supabase.functions.invoke("user-settings", {
      method: opts.method,
      headers: { Authorization: `Bearer ${token}` },
      ...(opts.method === "POST" ? { body: opts.body } : {}),
      timeout: USER_SETTINGS_FN_TIMEOUT_MS,
    });
  };

  let { data, error } = await run(false);
  if (error) {
    const msg = await edgeFunctionErrorMessage(error);
    if (isAuthLikeInvokeFailure(error, msg)) {
      ({ data, error } = await run(true));
    }
    if (error) {
      throw new Error(await edgeFunctionErrorMessage(error));
    }
  }
  return data;
}

function normalizeSettingsPayload(data: unknown): UserSettings {
  const payload = data as { settings?: UserSettings; error?: string } | null;
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    throw new Error(payload.error);
  }
  if (!payload?.settings) {
    throw new Error("Invalid settings response");
  }
  const s = payload.settings;
  const displayNameRaw = s.display_name;
  return {
    ...s,
    demo_mode: Boolean(s.demo_mode),
    onboarding_completed:
      typeof s.onboarding_completed === "boolean" ? s.onboarding_completed : true,
    display_name:
      typeof displayNameRaw === "string"
        ? displayNameRaw.trim() || null
        : null,
    ambient_allowed_actions: Array.isArray(s.ambient_allowed_actions)
      ? s.ambient_allowed_actions
      : [],
  };
}

export function useUserSettings() {
  const { user, getAccessToken } = useAuth();

  return useQuery({
    queryKey: ["user_settings", user?.id],
    queryFn: async (): Promise<UserSettings | null> => {
      if (!user) return null;
      const data = await invokeUserSettings(getAccessToken, { method: "GET" });
      return normalizeSettingsPayload(data);
    },
    enabled: !!user,
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  const { user, getAccessToken } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<UserSettings, "id" | "user_id">>) => {
      if (!user) throw new Error("Not signed in");
      const data = await invokeUserSettings(getAccessToken, {
        method: "POST",
        body: updates,
      });
      return normalizeSettingsPayload(data);
    },
    onSuccess: (data) => {
      if (user?.id) {
        queryClient.setQueryData(["user_settings", user.id], data);
      }
      queryClient.invalidateQueries({ queryKey: ["user_settings"] });
    },
  });
}
