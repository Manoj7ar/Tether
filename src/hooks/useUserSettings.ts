import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
      // #region agent log
      fetch("http://127.0.0.1:7331/ingest/73856759-8783-4062-ac2d-fb1e9443f226", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fa3011" },
        body: JSON.stringify({
          sessionId: "fa3011",
          location: "useUserSettings.ts:queryFn",
          message: "user_settings_query_start",
          data: { hasUserId: !!user?.id },
          timestamp: Date.now(),
          hypothesisId: "H2",
        }),
      }).catch(() => {});
      // #endregion
      if (!user) return null;
      try {
        const token = await withTimeout(
          getAccessToken(),
          ACCESS_TOKEN_TIMEOUT_MS,
          "Could not refresh your session in time. Try signing out and back in.",
        );
        // #region agent log
        fetch("http://127.0.0.1:7331/ingest/73856759-8783-4062-ac2d-fb1e9443f226", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fa3011" },
          body: JSON.stringify({
            sessionId: "fa3011",
            location: "useUserSettings.ts:queryFn",
            message: "user_settings_token_ok",
            data: { tokenLen: token?.length ?? 0 },
            timestamp: Date.now(),
            hypothesisId: "H2",
          }),
        }).catch(() => {});
        // #endregion
        const { data, error } = await supabase.functions.invoke("user-settings", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
          timeout: USER_SETTINGS_FN_TIMEOUT_MS,
        });
        if (error) throw new Error(await edgeFunctionErrorMessage(error));
        // #region agent log
        fetch("http://127.0.0.1:7331/ingest/73856759-8783-4062-ac2d-fb1e9443f226", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fa3011" },
          body: JSON.stringify({
            sessionId: "fa3011",
            location: "useUserSettings.ts:queryFn",
            message: "user_settings_invoke_ok",
            data: { onboarding_completed: (data as { settings?: { onboarding_completed?: boolean } })?.settings?.onboarding_completed ?? null },
            timestamp: Date.now(),
            hypothesisId: "H2",
          }),
        }).catch(() => {});
        // #endregion
        return normalizeSettingsPayload(data);
      } catch (e) {
        // #region agent log
        fetch("http://127.0.0.1:7331/ingest/73856759-8783-4062-ac2d-fb1e9443f226", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fa3011" },
          body: JSON.stringify({
            sessionId: "fa3011",
            location: "useUserSettings.ts:queryFn",
            message: "user_settings_query_error",
            data: { err: e instanceof Error ? e.message : String(e) },
            timestamp: Date.now(),
            hypothesisId: "H2",
          }),
        }).catch(() => {});
        // #endregion
        throw e;
      }
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
      const token = await withTimeout(
        getAccessToken(),
        ACCESS_TOKEN_TIMEOUT_MS,
        "Could not refresh your session in time. Try signing out and back in.",
      );
      const { data, error } = await supabase.functions.invoke("user-settings", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: updates,
        timeout: USER_SETTINGS_FN_TIMEOUT_MS,
      });
      if (error) throw new Error(await edgeFunctionErrorMessage(error));
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
