import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { callEdgeApi, callEdgeFn } from "@/lib/edge-call";
import {
  DEMO_MISSIONS,
  DEMO_EXECUTION_LOGS,
  DEMO_CONNECTED_ACCOUNTS,
  DEMO_MISSION_PERMISSIONS,
  DEMO_MISSION_STATS,
} from "@/lib/demo-data";
import type { Tables } from "@/integrations/supabase/types";

export type Mission = Tables<"missions">;
export type MissionPermission = Tables<"mission_permissions">;
export type ExecutionLogEntry = Tables<"execution_log">;
export type ConnectedAccount = Tables<"connected_accounts">;

const MISSIONS_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/missions-api`;
const CREATE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mission`;

// ── Hooks ──────────────────────────────────────────────────────────────

export function useMissions(statusFilter?: string) {
  const { user, getAccessToken } = useAuth();
  const demo = useDemoMode();
  return useQuery({
    queryKey: ["missions", statusFilter, demo],
    queryFn: async () => {
      if (demo) {
        let missions = DEMO_MISSIONS as unknown as Mission[];
        if (statusFilter && statusFilter !== "all") missions = missions.filter((m) => m.status === statusFilter);
        return missions;
      }
      const data = await callEdgeApi(getAccessToken, {
        url: MISSIONS_API_URL,
        body: { action: "list", statusFilter },
      });
      return (data ?? []) as Mission[];
    },
    enabled: !!user,
  });
}

export function useActiveMissions() {
  const { user, getAccessToken } = useAuth();
  const demo = useDemoMode();
  return useQuery({
    queryKey: ["missions", "active", demo],
    queryFn: async () => {
      if (demo) return (DEMO_MISSIONS as unknown as Mission[]).filter((m) => m.status === "active");
      const data = await callEdgeApi(getAccessToken, {
        url: MISSIONS_API_URL,
        body: { action: "list_active" },
      });
      return (data ?? []) as Mission[];
    },
    enabled: !!user,
  });
}

export function useMission(id: string | undefined) {
  const { user, getAccessToken } = useAuth();
  const demo = useDemoMode();
  return useQuery({
    queryKey: ["mission", id, demo],
    queryFn: async () => {
      if (demo) {
        const found = (DEMO_MISSIONS as unknown as Mission[]).find((m) => m.id === id);
        if (found) return found;
        const stored = id ? sessionStorage.getItem(`demo_mission_${id}`) : null;
        if (stored) return JSON.parse(stored) as Mission;
        return null;
      }
      const stored = id ? sessionStorage.getItem(`demo_mission_${id}`) : null;
      if (stored) return JSON.parse(stored) as Mission;
      const data = await callEdgeApi(getAccessToken, {
        url: MISSIONS_API_URL,
        body: { action: "get", id },
      });
      return (data as Mission) ?? null;
    },
    enabled: !!user && !!id,
  });
}

export function useMissionPermissions(missionId: string | undefined) {
  const { getAccessToken } = useAuth();
  const demo = useDemoMode();
  return useQuery({
    queryKey: ["mission_permissions", missionId, demo],
    queryFn: async () => {
      if (demo) return DEMO_MISSION_PERMISSIONS as unknown as MissionPermission[];
      const data = await callEdgeApi(getAccessToken, {
        url: MISSIONS_API_URL,
        body: { action: "list_permissions", mission_id: missionId },
      });
      return (data ?? []) as MissionPermission[];
    },
    enabled: !!missionId,
  });
}

export function useExecutionLog(missionId?: string) {
  const { user, getAccessToken } = useAuth();
  const demo = useDemoMode();
  return useQuery({
    queryKey: ["execution_log", missionId, demo],
    queryFn: async () => {
      if (demo) {
        const logs = DEMO_EXECUTION_LOGS as unknown as ExecutionLogEntry[];
        return missionId ? logs.filter((l) => l.mission_id === missionId) : logs;
      }
      const data = await callEdgeApi(getAccessToken, {
        url: MISSIONS_API_URL,
        body: { action: "list_execution_log", mission_id: missionId, limit: 100 },
      });
      return (data ?? []) as ExecutionLogEntry[];
    },
    enabled: !!user,
  });
}

export function useRecentActivity() {
  const { user, getAccessToken } = useAuth();
  const demo = useDemoMode();
  return useQuery({
    queryKey: ["execution_log", "recent", demo],
    queryFn: async () => {
      if (demo) return (DEMO_EXECUTION_LOGS as unknown as ExecutionLogEntry[]).slice(0, 20);
      const data = await callEdgeApi(getAccessToken, {
        url: MISSIONS_API_URL,
        body: { action: "list_execution_log", limit: 20 },
      });
      return (data ?? []) as ExecutionLogEntry[];
    },
    enabled: !!user,
  });
}

export function useConnectedAccounts() {
  const { user, getAccessToken } = useAuth();
  const demo = useDemoMode();
  return useQuery({
    queryKey: ["connected_accounts", demo],
    queryFn: async () => {
      if (demo) return DEMO_CONNECTED_ACCOUNTS as unknown as ConnectedAccount[];
      const data = await callEdgeApi(getAccessToken, {
        url: MISSIONS_API_URL,
        body: { action: "list_connected_accounts" },
      });
      return (data ?? []) as ConnectedAccount[];
    },
    enabled: !!user,
  });
}

export function useCreateMission() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const demo = useDemoMode();

  return useMutation({
    mutationFn: async (input: {
      objective: string;
      time_limit_mins: number;
      manifest_json?: Record<string, unknown>;
      risk_level?: string;
      intent_audit?: Record<string, unknown>;
      permissions?: { provider: string; scope: string; action_type: string; reason?: string }[];
    }) => {
      if (demo) {
        const fakeId = crypto.randomUUID();
        const nowTs = new Date();
        const fake = {
          id: fakeId,
          tether_number: Math.floor(Math.random() * 900) + 100,
          objective: input.objective,
          status: "pending",
          time_limit_mins: input.time_limit_mins,
          risk_level: input.risk_level || "low",
          manifest_json: input.manifest_json || null,
          created_at: nowTs.toISOString(),
          approved_at: null,
          expires_at: null,
          completed_at: null,
          user_id: "demo",
        } as unknown as Mission;
        sessionStorage.setItem(`demo_mission_${fakeId}`, JSON.stringify(fake));
        return fake;
      }
      const data = await callEdgeApi(getAccessToken, {
        url: CREATE_FN_URL,
        body: input as unknown as Record<string, unknown>,
      });
      return data as Mission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useUpdateMissionStatus() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const demo = useDemoMode();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (demo) {
        const stored = sessionStorage.getItem(`demo_mission_${id}`);
        if (stored) {
          const m = JSON.parse(stored) as Record<string, unknown>;
          m.status = status;
          if (status === "active") {
            m.approved_at = new Date().toISOString();
            m.expires_at = new Date(Date.now() + ((m.time_limit_mins as number) || 30) * 60_000).toISOString();
          }
          if (status === "completed" || status === "rejected") m.completed_at = new Date().toISOString();
          sessionStorage.setItem(`demo_mission_${id}`, JSON.stringify(m));
          return m as unknown as Mission;
        }
        const found = (DEMO_MISSIONS as unknown as Mission[]).find((m) => m.id === id);
        return found || ({ id, status } as unknown as Mission);
      }

      if (status === "active") {
        const result = await callEdgeFn(getAccessToken, {
          functionName: "mission-approve",
          body: { mission_id: id },
        });
        const payload = result as { error?: string; mission?: Mission; blocked?: boolean };
        if (payload?.error || !payload?.mission) {
          throw new Error(payload?.error || "Approval failed");
        }
        return payload.mission;
      }

      const updates: Record<string, unknown> = { status };
      if (status === "completed" || status === "rejected") {
        updates.completed_at = new Date().toISOString();
      }

      const data = await callEdgeApi(getAccessToken, {
        url: MISSIONS_API_URL,
        body: { action: "update", id, updates },
      });
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
  const { user, getAccessToken } = useAuth();
  const demo = useDemoMode();
  return useQuery({
    queryKey: ["mission_stats", demo],
    queryFn: async () => {
      if (demo) return DEMO_MISSION_STATS;
      const data = await callEdgeApi(getAccessToken, {
        url: MISSIONS_API_URL,
        body: { action: "mission_stats" },
      });
      return data as {
        totalMissions: number;
        actionsApproved: number;
        actionsBlocked: number;
      };
    },
    enabled: !!user,
  });
}
