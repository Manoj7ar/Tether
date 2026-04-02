import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAppConfig } from "@/lib/env";
import { useAuth } from "@/hooks/useAuth";

export interface UserSettings {
  id: string;
  user_id: string;
  mcp_enabled: boolean;
  ambient_enabled: boolean;
  ambient_budget_max: number;
  ambient_budget_used: number;
  ambient_budget_window_start: string;
  ambient_allowed_actions: string[];
}

function functionsBaseUrl(): string {
  const { supabaseProjectId, supabaseUrl } = getAppConfig();
  if (supabaseProjectId) {
    return `https://${supabaseProjectId}.supabase.co/functions/v1`;
  }
  return `${supabaseUrl}/functions/v1`;
}

async function parseSettingsResponse(res: Response): Promise<UserSettings> {
  const data = await res.json().catch(() => ({})) as { settings?: UserSettings; error?: string };
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Settings request failed");
  }
  if (!data.settings) {
    throw new Error("Invalid settings response");
  }
  const s = data.settings;
  return {
    ...s,
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
      const token = await getAccessToken();
      const res = await fetch(`${functionsBaseUrl()}/user-settings`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: getAppConfig().supabasePublishableKey,
        },
      });
      return parseSettingsResponse(res);
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
      const token = await getAccessToken();
      const res = await fetch(`${functionsBaseUrl()}/user-settings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: getAppConfig().supabasePublishableKey,
        },
        body: JSON.stringify(updates),
      });
      return parseSettingsResponse(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_settings"] });
    },
  });
}
