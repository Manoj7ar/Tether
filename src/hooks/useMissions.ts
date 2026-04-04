/**
 * Mission hooks — all queries go through the `missions-api` Edge Function
 * (service-role key) so Auth0 opaque tokens work with Postgres.
 */
import type { GetTokenSilentlyOptions } from "@auth0/auth0-spa-js";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { edgeFunctionErrorMessage } from "@/lib/supabase-functions";
import type { Tables } from "@/integrations/supabase/types";

export type Mission = Tables<"missions">;
export type MissionPermission = Tables<"mission_permissions">;
export type ExecutionLogEntry = Tables<"execution_log">;
export type ConnectedAccount = Tables<"connected_accounts">;

const TOKEN_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout>;
  const tp = new Promise<never>((_, rej) => { tid = setTimeout(() => rej(new Error(msg)), ms); });
  return Promise.race([promise, tp]).finally(() => clearTimeout(tid!));
}

function isAuthFailure(error: unknown, msg: string): boolean {
  if (/invalid or expired session|unauthorized/i.test(msg)) return true;
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    return error.context.status === 401;
  }
  return false;
}

function isLoginRequired(err: unknown): boolean {
  return err instanceof Error && /login.required|login_required|consent.required/i.test(err.message);
}

async function callMissionsApi(
  getAccessToken: (opts?: GetTokenSilentlyOptions) => Promise<string>,
  body: Record<string, unknown>,
): Promise<unknown> {
  const run = async (force: boolean) => {
    let token: string;
    try {
      token = await withTimeout(
        getAccessToken(force ? { cacheMode: "off" } : {}),
        TOKEN_TIMEOUT_MS,
        "Session expired — try signing out and back in.",
      );
    } catch (e) {
      if (!force && isLoginRequired(e)) {
        token = await withTimeout(
          getAccessToken({ cacheMode: "off" }),
          TOKEN_TIMEOUT_MS,
          "Session expired — try signing out and back in.",
        );
      } else {
        throw e;
      }
    }
    return supabase.functions.invoke("missions-api", {
      body,
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  let { data, error } = await run(false);
  if (error) {
    const msg = await edgeFunctionErrorMessage(error);
    if (isAuthFailure(error, msg)) {
      ({ data, error } = await run(true));
    }
    if (error) throw new Error(await edgeFunctionErrorMessage(error));
  }

  const payload = data as { data?: unknown; error?: string } | null;
  if (payload && typeof payload.error === "string" && payload.error.trim()) {
    throw new Error(payload.error);
  }
  return payload?.data ?? null;
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
      const { permissions, ...rest } = input;
      const data = await callMissionsApi(getAccessToken, {
        action: "create",
        mission: rest,
        permissions,
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
