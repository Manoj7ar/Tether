import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { callEdgeFn } from "@/lib/edge-call";
import { DEMO_NUDGES } from "@/lib/demo-data";

export interface Nudge {
  type: "suggestion" | "warning" | "optimization";
  title: string;
  body: string;
}

export function useNudges() {
  const { user, getAccessToken } = useAuth();
  const demo = useDemoMode();

  const query = useQuery({
    queryKey: ["nudges", user?.id, demo],
    queryFn: async (): Promise<{ nudges: Nudge[]; dismissedIds: string[] }> => {
      if (demo) return { nudges: DEMO_NUDGES, dismissedIds: [] };

      const data = await callEdgeFn(getAccessToken, {
        functionName: "generate-nudges",
      });

      const { data: nudgeRow } = await supabase
        .from("user_nudges")
        .select("dismissed_ids")
        .eq("user_id", user!.id)
        .maybeSingle();

      const dismissedIds = Array.isArray(nudgeRow?.dismissed_ids) ? (nudgeRow.dismissed_ids as string[]) : [];

      return {
        nudges: (data as { nudges?: Nudge[] })?.nudges || [],
        dismissedIds,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  return query;
}

export function useDismissNudge() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const demo = useDemoMode();

  return useMutation({
    mutationFn: async (nudgeTitle: string) => {
      if (demo) return;

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
