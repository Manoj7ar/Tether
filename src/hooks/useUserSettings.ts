import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { edgeFunctionErrorMessage } from "@/lib/supabase-functions";

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
  return {
    ...s,
    demo_mode: Boolean(s.demo_mode),
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
      const { data, error } = await supabase.functions.invoke("user-settings", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error) throw new Error(await edgeFunctionErrorMessage(error));
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
      const token = await getAccessToken();
      const { data, error } = await supabase.functions.invoke("user-settings", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: updates,
      });
      if (error) throw new Error(await edgeFunctionErrorMessage(error));
      return normalizeSettingsPayload(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_settings"] });
    },
  });
}
