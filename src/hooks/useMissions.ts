import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { edgeFunctionErrorMessage } from "@/lib/supabase-functions";
import type { Json, Tables } from "@/integrations/supabase/types";

export type Mission = Tables<"missions">;
export type MissionPermission = Tables<"mission_permissions">;
export type ExecutionLogEntry = Tables<"execution_log">;
export type ConnectedAccount = Tables<"connected_accounts">;

export function useMissions(statusFilter?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["missions", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Mission[];
    },
    enabled: !!user,
  });
}

export function useActiveMissions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["missions", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Mission[];
    },
    enabled: !!user,
  });
}

export function useMission(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mission", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Mission | null;
    },
    enabled: !!user && !!id,
  });
}

export function useMissionPermissions(missionId: string | undefined) {
  return useQuery({
    queryKey: ["mission_permissions", missionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mission_permissions")
        .select("*")
        .eq("mission_id", missionId!);
      if (error) throw error;
      return data as MissionPermission[];
    },
    enabled: !!missionId,
  });
}

export function useExecutionLog(missionId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["execution_log", missionId],
    queryFn: async () => {
      let query = supabase
        .from("execution_log")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(100);

      if (missionId) {
        query = query.eq("mission_id", missionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExecutionLogEntry[];
    },
    enabled: !!user,
  });
}

export function useRecentActivity() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["execution_log", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("execution_log")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as ExecutionLogEntry[];
    },
    enabled: !!user,
  });
}

export function useConnectedAccounts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["connected_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connected_accounts")
        .select("id, provider, provider_username, scopes, connected_at, is_active, user_id")
        .order("connected_at", { ascending: false });
      if (error) throw error;
      return data as ConnectedAccount[];
    },
    enabled: !!user,
  });
}

export function useCreateMission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      objective: string;
      time_limit_mins: number;
      manifest_json?: Record<string, unknown>;
      risk_level?: string;
      intent_audit?: Record<string, unknown>;
      permissions?: { provider: string; scope: string; action_type: string; reason?: string }[];
    }) => {
      const { permissions, ...rest } = input;

      const { data: mission, error } = await supabase
        .from("missions")
        .insert({
          objective: rest.objective,
          time_limit_mins: rest.time_limit_mins,
          manifest_json: (rest.manifest_json ?? null) as Json,
          risk_level: rest.risk_level,
          intent_audit: (rest.intent_audit ?? null) as Json,
          user_id: user!.id,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      if (permissions && permissions.length > 0) {
        const { error: permError } = await supabase
          .from("mission_permissions")
          .insert(
            permissions.map((p) => ({
              mission_id: mission.id,
              provider: p.provider,
              scope: p.scope,
              action_type: p.action_type,
              reason: p.reason,
            }))
          );
        if (permError) throw permError;
      }

      return mission as Mission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useUpdateMissionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (status === "active") {
        const { data, error } = await supabase.functions.invoke("mission-approve", {
          body: { mission_id: id },
        });
        if (error) {
          throw new Error(await edgeFunctionErrorMessage(error));
        }
        const payload = data as { error?: string; mission?: Mission; blocked?: boolean };
        if (payload?.error || !payload?.mission) {
          throw new Error(payload?.error || "Approval failed");
        }
        return payload.mission;
      }

      const updates: Record<string, unknown> = { status };
      if (status === "completed" || status === "rejected") {
        updates.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("missions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Mission;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["mission", vars.id] });
      if (vars.status === "active") {
        queryClient.invalidateQueries({ queryKey: ["step_up_status", vars.id] });
      }
    },
  });
}

export function useMissionStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mission_stats"],
    queryFn: async () => {
      const [missionsRes, logsRes] = await Promise.all([
        supabase.from("missions").select("id, status", { count: "exact" }),
        supabase.from("execution_log").select("id, status", { count: "exact" }),
      ]);

      if (missionsRes.error) throw missionsRes.error;
      if (logsRes.error) throw logsRes.error;

      const missions = missionsRes.data || [];
      const logs = logsRes.data || [];

      return {
        totalMissions: missions.length,
        actionsApproved: logs.filter((l) => l.status === "allowed").length,
        actionsBlocked: logs.filter((l) => l.status === "blocked").length,
      };
    },
    enabled: !!user,
  });
}
