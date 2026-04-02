import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

export function useUserSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user_settings", user?.id],
    queryFn: async (): Promise<UserSettings | null> => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        ambient_allowed_actions: Array.isArray(data.ambient_allowed_actions)
          ? (data.ambient_allowed_actions as string[])
          : [],
      } as UserSettings;
    },
    enabled: !!user,
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Omit<UserSettings, "id" | "user_id">>) => {
      const { data: existing } = await supabase
        .from("user_settings")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("user_settings")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_settings")
          .insert({ user_id: user!.id, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_settings"] });
    },
  });
}
