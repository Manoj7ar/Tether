import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Nudge {
  type: "suggestion" | "warning" | "optimization";
  title: string;
  body: string;
}

export function useNudges() {
  const { user, getAccessToken } = useAuth();

  const query = useQuery({
    queryKey: ["nudges", user?.id],
    queryFn: async (): Promise<{ nudges: Nudge[]; dismissedIds: string[] }> => {
      const token = await getAccessToken();
      const { data, error } = await supabase.functions.invoke("generate-nudges", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        console.error("Nudge fetch error:", error);
        return { nudges: [], dismissedIds: [] };
      }

      // Also get dismissed IDs
      const { data: nudgeRow } = await supabase
        .from("user_nudges")
        .select("dismissed_ids")
        .eq("user_id", user!.id)
        .maybeSingle();

      const dismissedIds = Array.isArray(nudgeRow?.dismissed_ids) ? (nudgeRow.dismissed_ids as string[]) : [];

      return {
        nudges: data?.nudges || [],
        dismissedIds,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return query;
}

export function useDismissNudge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (nudgeTitle: string) => {
      const { data: existing } = await supabase
        .from("user_nudges")
        .select("dismissed_ids")
        .eq("user_id", user!.id)
        .maybeSingle();

      const current = Array.isArray(existing?.dismissed_ids) ? (existing.dismissed_ids as string[]) : [];
      const updated = [...current, nudgeTitle];

      await supabase
        .from("user_nudges")
        .update({ dismissed_ids: updated, updated_at: new Date().toISOString() })
        .eq("user_id", user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nudges"] });
    },
  });
}
