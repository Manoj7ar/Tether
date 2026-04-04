import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { DEMO_TRUST_SCORE } from "@/lib/demo-data";

export interface TrustScoreData {
  score: number;
  total_allowed: number;
  total_blocked: number;
  history: { date: string; score: number }[];
}

interface TrustScoreHistoryEntry {
  date: string;
  score: number;
}

export function useTrustScore() {
  const { user } = useAuth();
  const demo = useDemoMode();

  return useQuery({
    queryKey: ["trust_score", user?.id, demo],
    queryFn: async (): Promise<TrustScoreData> => {
      if (demo) return DEMO_TRUST_SCORE;

      const { data, error } = await supabase
        .from("agent_trust_scores")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return { score: 100, total_allowed: 0, total_blocked: 0, history: [] };
      }

      return {
        score: data.score,
        total_allowed: data.total_allowed,
        total_blocked: data.total_blocked,
        history: Array.isArray(data.history_json) ? (data.history_json as TrustScoreHistoryEntry[]) : [],
      };
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}
