import { Link } from "react-router-dom";
import { Plus, Activity, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useActiveMissions, useRecentActivity } from "@/hooks/useMissions";
import { useConnectedAccounts } from "@/hooks/useMissions";
import { useRealtimeExecutionLog } from "@/hooks/useRealtimeExecutionLog";
import LiveExecutionFeed from "@/components/LiveExecutionFeed";
import DashboardAnalytics from "@/components/DashboardAnalytics";
import MissionTemplates from "@/components/MissionTemplates";
import TrustScoreCard from "@/components/TrustScoreCard";
import NudgeCards from "@/components/NudgeCards";
import AmbientBudgetCard from "@/components/AmbientBudgetCard";
import { formatDistanceToNow, format } from "date-fns";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

const statusStyles: Record<string, string> = {
  pending: "bg-accent text-accent-foreground animate-pulse-status",
  active: "bg-primary text-primary-foreground",
  expired: "bg-muted text-muted-foreground",
  completed: "bg-primary/10 text-primary",
  rejected: "bg-destructive text-destructive-foreground",
};

const statusLabels: Record<string, string> = {
  pending: "PENDING APPROVAL",
  active: "ACTIVE",
  expired: "EXPIRED",
  completed: "COMPLETED",
  rejected: "REJECTED",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: activeMissions = [], isLoading: missionsLoading } = useActiveMissions();
  const { data: recentActivity = [], isLoading: activityLoading } = useRecentActivity();
  const { data: connectedAccounts = [] } = useConnectedAccounts();
  const { liveEntries } = useRealtimeExecutionLog();

  const mergedActivity = useMemo(() => {
    const seen = new Set<string>();
    const all = [...liveEntries, ...recentActivity];
    return all.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    }).slice(0, 20);
  }, [liveEntries, recentActivity]);

  const getRiskLevel = (mission: typeof activeMissions[0]) => {
    return (mission.risk_level as "low" | "medium" | "high") || "low";
  };

  const getTimeRemaining = (mission: typeof activeMissions[0]) => {
    if (!mission.expires_at) return null;
    const expires = new Date(mission.expires_at);
    const now = new Date();
    if (expires <= now) return "Expired";
    const diff = expires.getTime() - now.getTime();
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-full">
      {/* Main */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Trust Score + Ambient Budget */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TrustScoreCard />
          <AmbientBudgetCard />
        </div>

        {/* Behavioral Nudges */}
        <NudgeCards />

        {/* Active Missions */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h1 className="font-display text-2xl font-bold text-foreground">Active Missions</h1>
            <Badge className="bg-primary text-primary-foreground">{activeMissions.length}</Badge>
          </div>

          {missionsLoading ? (
            <div className="card-tether p-12 text-center">
              <p className="text-sm text-muted-foreground">Loading missions...</p>
            </div>
          ) : activeMissions.length === 0 ? (
            <div className="card-tether p-12 text-center">
              <div className="mb-4"><Unlock className="h-10 w-10 text-muted-foreground mx-auto" /></div>
              <h2 className="font-display text-xl font-semibold text-foreground mb-2">No active missions</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your agent currently has zero access to any of your accounts. Create a mission to grant temporary, scoped access.
              </p>
              <Link to="/mission/new" className="btn-glass-primary inline-flex items-center gap-2 px-6 py-3 text-sm">
                <Plus className="h-4 w-4" /> Create New Mission
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {activeMissions.map((m, i) => (
                <Link
                  key={m.id}
                  to={`/mission/${m.id}`}
                  className={`card-tether p-5 block hover:shadow-md transition-shadow animate-card-in ${
                    { low: "risk-border-low", medium: "risk-border-medium", high: "risk-border-high" }[getRiskLevel(m)]
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm text-primary font-semibold">TETHER #{String(m.tether_number).padStart(3, "0")}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusStyles[m.status] || ""}`}>
                      {statusLabels[m.status] || m.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2 mb-3">{m.objective}</p>
                  {m.status === "active" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Activity className="h-3 w-3" />
                      <span>Expires {getTimeRemaining(m) || "—"}</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Launch */}
        <div>
          <h2 className="font-medium text-foreground mb-3">Quick Launch</h2>
          <MissionTemplates
            compact
            onSelect={(t) => navigate("/mission/new", { state: { objective: t.objective, timeLimit: t.timeLimit } })}
          />
        </div>

        {/* Analytics */}
        <div>
          <h2 className="font-medium text-foreground mb-3">Analytics</h2>
          <DashboardAnalytics />
        </div>

        {/* Real-time Activity Feed */}
        <div>
          <h2 className="font-medium text-foreground mb-3 flex items-center gap-2">
            Recent Activity
            {liveEntries.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Live
              </span>
            )}
          </h2>
          <LiveExecutionFeed
            entries={mergedActivity}
            isEmpty={mergedActivity.length === 0}
            isLoading={activityLoading}
          />
        </div>
      </div>

      {/* Right Panel */}
      <aside className="hidden xl:block w-72 border-l border-border p-6 space-y-6">
        <div>
          <h3 className="font-medium text-foreground text-sm mb-3">Connected Accounts</h3>
          <div className="space-y-2">
            {connectedAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No accounts connected yet.</p>
            ) : (
              connectedAccounts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${a.is_active ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <span className="text-foreground">{a.provider}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{a.provider_username || "—"}</span>
                </div>
              ))
            )}
            <Link to="/accounts" className="text-xs text-primary hover:underline block mt-2">Manage accounts →</Link>
          </div>
        </div>

        <div>
          <h3 className="font-medium text-foreground text-sm mb-3">Agent Endpoint</h3>
          <div className="code-surface p-3 text-xs break-all">
            POST {import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-action
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Point your agent at this endpoint. It submits action requests; Tether enforces scope, policy, and expiry.
          </p>
        </div>
      </aside>
    </div>
  );
}
