import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Json } from "@/integrations/supabase/types";

export interface PolicyRule {
  id: string;
  action: string;
  enabled: boolean;
  conditions: Record<string, unknown>;
}

export interface PolicyRulesRow {
  id: string;
  user_id: string;
  rules_json: PolicyRule[];
  updated_at: string;
}

export function usePolicyRules() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["policy_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policy_rules")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { id: null, rules: [] as PolicyRule[] };
      const rules = (data.rules_json as unknown as PolicyRule[]) || [];
      return { id: data.id, rules };
    },
    enabled: !!user,
  });
}

export function useSavePolicyRules() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ existingId, rules }: { existingId: string | null; rules: PolicyRule[] }) => {
      if (existingId) {
        const { error } = await supabase
          .from("policy_rules")
          .update({ rules_json: rules as unknown as Json })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("policy_rules")
          .insert({ user_id: user!.id, rules_json: rules as unknown as Json });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy_rules"] });
    },
  });
}
