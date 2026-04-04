import type { GetTokenSilentlyOptions } from "@auth0/auth0-spa-js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { edgeFunctionErrorMessage } from "@/lib/supabase-functions";
import type { Tables } from "@/integrations/supabase/types";

export type Mission = Tables<"missions">;
export type MissionPermission = Tables<"mission_permissions">;
export type ExecutionLogEntry = Tables<"execution_log">;
export type ConnectedAccount = Tables<"connected_accounts">;

const TOKEN_TIMEOUT_MS = 20_000;
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/missions-api`;

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout>;
  const tp = new Promise<never>((_, rej) => { tid = setTimeout(() => rej(new Error(msg)), ms); });
  return Promise.race([promise, tp]).finally(() => clearTimeout(tid!));
}

function isLoginRequired(err: unknown): boolean {
  return err instanceof Error && /login.required|login_required|consent.required/i.test(err.message);
}

async function callMissionsApi(
  getAccessToken: (opts?: GetTokenSilentlyOptions) => Promise<string>,
  body: Record<string, unknown>,
): Promise<unknown> {
  const doFetch = async (token: string) => {
    const res = await fetch(FUNCTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  };

  let token: string;
  try {
    token = await withTimeout(
      getAccessToken(),
      TOKEN_TIMEOUT_MS,
      "Session expired — try signing out and back in.",
    );
  } catch (e) {
    if (isLoginRequired(e)) {
      token = await withTimeout(
        getAccessToken({ cacheMode: "off" }),
        TOKEN_TIMEOUT_MS,
        "Session expired — try signing out and back in.",
      );
    } else {
      throw e;
    }
  }

  let { status, json } = await doFetch(token);

  if (status === 401) {
    const freshToken = await withTimeout(
      getAccessToken({ cacheMode: "off" }),
      TOKEN_TIMEOUT_MS,
      "Session expired — try signing out and back in.",
    );
    ({ status, json } = await doFetch(freshToken));
  }

  if (!json) throw new Error("Empty response from server");
  if (status >= 400) throw new Error(json.error || `Server error (${status})`);
  if (json.error) throw new Error(json.error);
  return json.data ?? null;
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useMissions(statusFilter?: string) {
  const { user, getAccessToken } = useAuth();
  return useQuery({
    queryKey: ["missions", statusFilter],
    queryFn: async () => {
      const data = await callMissionsApi(getAccessToken, { action: "list", statusFilter });
      return (data ?? []) as Mission[];
    },
    enabled: !!user,
  });
}

export function useActiveMissions() {
  const { user, getAccessToken } = useAuth();
  return useQuery({
    queryKey: ["missions", "active"],
    queryFn: async () => {
      const data = await callMissionsApi(getAccessToken, { action: "list_active" });
      return (data ?? []) as Mission[];
    },
    enabled: !!user,
  });
}

export function useMission(id: string | undefined) {
  const { user, getAccessToken } = useAuth();
  return useQuery({
    queryKey: ["mission", id],
    queryFn: async () => {
      const data = await callMissionsApi(getAccessToken, { action: "get", id });
      return (data as Mission) ?? null;
    },
    enabled: !!user && !!id,
  });
}

export function useMissionPermissions(missionId: string | undefined) {
  const { getAccessToken } = useAuth();
  return useQuery({
    queryKey: ["mission_permissions", missionId],
    queryFn: async () => {
      const data = await callMissionsApi(getAccessToken, { action: "list_permissions", mission_id: missionId });
      return (data ?? []) as MissionPermission[];
    },
    enabled: !!missionId,
  });
}

export function useExecutionLog(missionId?: string) {
  const { user, getAccessToken } = useAuth();
  return useQuery({
    queryKey: ["execution_log", missionId],
    queryFn: async () => {
      const data = await callMissionsApi(getAccessToken, {
        action: "list_execution_log",
        mission_id: missionId,
        limit: 100,
      });
      return (data ?? []) as ExecutionLogEntry[];
    },
    enabled: !!user,
  });
}

export function useRecentActivity() {
  const { user, getAccessToken } = useAuth();
  return useQuery({
    queryKey: ["execution_log", "recent"],
    queryFn: async () => {
      const data = await callMissionsApi(getAccessToken, {
        action: "list_execution_log",
        limit: 20,
      });
      return (data ?? []) as ExecutionLogEntry[];
    },
    enabled: !!user,
  });
}

export function useConnectedAccounts() {
  const { user, getAccessToken } = useAuth();
  return useQuery({
    queryKey: ["connected_accounts"],
    queryFn: async () => {
      const data = await callMissionsApi(getAccessToken, { action: "list_connected_accounts" });
      return (data ?? []) as ConnectedAccount[];
    },
    enabled: !!user,
  });
}

const CREATE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mission`;

export function useCreateMission() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      objective: string;
      time_limit_mins: number;
      manifest_json?: Record<string, unknown>;
      risk_level?: string;
      intent_audit?: Record<string, unknown>;
      permissions?: { provider: string; scope: string; action_type: string; reason?: string }[];
    }) => {
      let token: string;
      try {
        token = await withTimeout(getAccessToken(), TOKEN_TIMEOUT_MS, "Session expired.");
      } catch (e) {
        if (isLoginRequired(e)) {
          token = await withTimeout(getAccessToken({ cacheMode: "off" }), TOKEN_TIMEOUT_MS, "Session expired.");
        } else { throw e; }
      }

      const res = await fetch(CREATE_FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => null);

      if (res.status === 401) {
        const fresh = await withTimeout(getAccessToken({ cacheMode: "off" }), TOKEN_TIMEOUT_MS, "Session expired.");
        const retry = await fetch(CREATE_FN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${fresh}` },
          body: JSON.stringify(input),
        });
        const retryJson = await retry.json().catch(() => null);
        if (!retry.ok) throw new Error(retryJson?.error || `Server error (${retry.status})`);
        if (retryJson?.error) throw new Error(retryJson.error);
        return retryJson.data as Mission;
      }

      if (!res.ok) throw new Error(json?.error || `Server error (${res.status})`);
      if (json?.error) throw new Error(json.error);
      return json.data as Mission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });
}

export function useUpdateMissionStatus() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (status === "active") {
        const { data, error } = await supabase.functions.invoke("mission-approve", {
          body: { mission_id: id },
        });
        if (error) throw new Error(await edgeFunctionErrorMessage(error));
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

      const result = await callMissionsApi(getAccessToken, {
        action: "update",
        id,
        updates,
      });
      return result as Mission;
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
  return useQuery({
    queryKey: ["mission_stats"],
    queryFn: async () => {
      const data = await callMissionsApi(getAccessToken, { action: "mission_stats" });
      return data as {
        totalMissions: number;
        actionsApproved: number;
        actionsBlocked: number;
      };
    },
    enabled: !!user,
  });
}
