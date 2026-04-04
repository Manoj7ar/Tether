import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { callEdgeApi } from "@/lib/edge-call";
import { DEMO_ANALYTICS } from "@/lib/demo-data";
import { subDays, format, startOfDay } from "date-fns";

const MISSIONS_API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/missions-api`;

export function useDashboardAnalytics() {
  const { user, getAccessToken } = useAuth();
  const demo = useDemoMode();

  return useQuery({
    queryKey: ["dashboard_analytics", demo],
    queryFn: async () => {
      if (demo) return DEMO_ANALYTICS;

      const raw = await callEdgeApi(getAccessToken, {
        url: MISSIONS_API_URL,
        body: { action: "analytics" },
      }) as { missions: { id: string; status: string; risk_level: string | null; created_at: string }[]; logs: { id: string; status: string; timestamp: string }[] };

      const { missions, logs } = raw ?? { missions: [], logs: [] };

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
