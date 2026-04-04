import type { GetTokenSilentlyOptions } from "@auth0/auth0-spa-js";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { subDays, format, startOfDay } from "date-fns";

const TOKEN_TIMEOUT_MS = 20_000;
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/missions-api`;

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout>;
  const tp = new Promise<never>((_, rej) => { tid = setTimeout(() => rej(new Error(msg)), ms); });
  return Promise.race([p, tp]).finally(() => clearTimeout(tid!));
}

async function callAnalytics(
  getAccessToken: (opts?: GetTokenSilentlyOptions) => Promise<string>,
): Promise<{ missions: { id: string; status: string; risk_level: string | null; created_at: string }[]; logs: { id: string; status: string; timestamp: string }[] }> {
  const doFetch = async (token: string) => {
    const res = await fetch(FUNCTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "analytics" }),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  };

  const token = await withTimeout(getAccessToken(), TOKEN_TIMEOUT_MS, "Session expired.");
  let { status, json } = await doFetch(token);

  if (status === 401) {
    const fresh = await withTimeout(getAccessToken({ cacheMode: "off" }), TOKEN_TIMEOUT_MS, "Session expired.");
    ({ status, json } = await doFetch(fresh));
  }

  if (!json) throw new Error("Empty response");
  if (status >= 400) throw new Error(json.error || `Server error (${status})`);
  if (json.error) throw new Error(json.error);
  return json.data ?? { missions: [], logs: [] };
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
