import type { GetTokenSilentlyOptions } from "@auth0/auth0-spa-js";
import { useQuery } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { edgeFunctionErrorMessage } from "@/lib/supabase-functions";
import { subDays, format, startOfDay } from "date-fns";

const TOKEN_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout>;
  const tp = new Promise<never>((_, rej) => { tid = setTimeout(() => rej(new Error(msg)), ms); });
  return Promise.race([p, tp]).finally(() => clearTimeout(tid!));
}

function isAuthFailure(error: unknown, msg: string): boolean {
  if (/invalid or expired session|unauthorized/i.test(msg)) return true;
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    return error.context.status === 401;
  }
  return false;
}

async function callAnalytics(
  getAccessToken: (opts?: GetTokenSilentlyOptions) => Promise<string>,
): Promise<{ missions: { id: string; status: string; risk_level: string | null; created_at: string }[]; logs: { id: string; status: string; timestamp: string }[] }> {
  const run = async (force: boolean) => {
    const token = await withTimeout(
      getAccessToken(force ? { cacheMode: "off" } : {}),
      TOKEN_TIMEOUT_MS,
      "Session expired.",
    );
    return supabase.functions.invoke("missions-api", {
      body: { action: "analytics" },
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  let { data, error } = await run(false);
  if (error) {
    const msg = await edgeFunctionErrorMessage(error);
    if (isAuthFailure(error, msg)) ({ data, error } = await run(true));
    if (error) throw new Error(await edgeFunctionErrorMessage(error));
  }
  const payload = data as { data?: { missions: []; logs: [] }; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  return payload?.data ?? { missions: [], logs: [] };
}

export function useDashboardAnalytics() {
  const { user, getAccessToken } = useAuth();

  return useQuery({
    queryKey: ["dashboard_analytics"],
    queryFn: async () => {
      const { missions, logs } = await callAnalytics(getAccessToken);

      const statusCounts: Record<string, number> = {};
      missions.forEach((m) => { statusCounts[m.status] = (statusCounts[m.status] || 0) + 1; });
      const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

      const riskCounts: Record<string, number> = { low: 0, medium: 0, high: 0 };
      missions.forEach((m) => {
        const r = m.risk_level || "low";
        riskCounts[r] = (riskCounts[r] || 0) + 1;
      });
      const riskDistribution = Object.entries(riskCounts).map(([name, value]) => ({ name, value }));

      const last30 = subDays(new Date(), 30);
      const dailyCounts: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        dailyCounts[format(startOfDay(subDays(new Date(), 29 - i)), "MMM dd")] = 0;
      }
      missions.forEach((m) => {
        const d = new Date(m.created_at);
        if (d >= last30) {
          const key = format(startOfDay(d), "MMM dd");
          if (key in dailyCounts) dailyCounts[key]++;
        }
      });
      const missionTimeline = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

      const completed = missions.filter((m) => m.status === "completed" || m.status === "active").length;
      const approvalRate = missions.length > 0 ? Math.round((completed / missions.length) * 100) : 0;

      return {
        statusDistribution,
        riskDistribution,
        missionTimeline,
        approvalRate,
        totalMissions: missions.length,
        actionsAllowed: logs.filter((l) => l.status === "allowed").length,
        actionsBlocked: logs.filter((l) => l.status === "blocked").length,
      };
    },
    enabled: !!user,
  });
}
