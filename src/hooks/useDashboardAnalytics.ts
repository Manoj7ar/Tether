import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subDays, format, startOfDay } from "date-fns";

export function useDashboardAnalytics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard_analytics"],
    queryFn: async () => {
      const [missionsRes, logsRes] = await Promise.all([
        supabase.from("missions").select("id, status, risk_level, created_at"),
        supabase.from("execution_log").select("id, status, timestamp"),
      ]);

      if (missionsRes.error) throw missionsRes.error;
      if (logsRes.error) throw logsRes.error;

      const missions = missionsRes.data ?? [];
      const logs = logsRes.data ?? [];

      // Status distribution
      const statusCounts: Record<string, number> = {};
      missions.forEach((m) => {
        statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
      });
      const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

      // Risk distribution
      const riskCounts: Record<string, number> = { low: 0, medium: 0, high: 0 };
      missions.forEach((m) => {
        const r = (m.risk_level as string) || "low";
        riskCounts[r] = (riskCounts[r] || 0) + 1;
      });
      const riskDistribution = Object.entries(riskCounts).map(([name, value]) => ({ name, value }));

      // Missions over last 30 days
      const last30 = subDays(new Date(), 30);
      const dailyCounts: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const day = format(startOfDay(subDays(new Date(), 29 - i)), "MMM dd");
        dailyCounts[day] = 0;
      }
      missions.forEach((m) => {
        const d = new Date(m.created_at);
        if (d >= last30) {
          const key = format(startOfDay(d), "MMM dd");
          if (key in dailyCounts) dailyCounts[key]++;
        }
      });
      const missionTimeline = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

      // Approval rate
      const completed = missions.filter((m) => m.status === "completed" || m.status === "active").length;
      const approvalRate = missions.length > 0 ? Math.round((completed / missions.length) * 100) : 0;

      // Actions allowed vs blocked
      const actionsAllowed = logs.filter((l) => l.status === "allowed").length;
      const actionsBlocked = logs.filter((l) => l.status === "blocked").length;

      return {
        statusDistribution,
        riskDistribution,
        missionTimeline,
        approvalRate,
        totalMissions: missions.length,
        actionsAllowed,
        actionsBlocked,
      };
    },
    enabled: !!user,
  });
}
