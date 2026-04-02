import { Link } from "react-router-dom";
import { Lock, Download, Play } from "lucide-react";
import { useMissions, useMissionStats, type ExecutionLogEntry } from "@/hooks/useMissions";
import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import MissionReplay from "@/components/MissionReplay";
import { getErrorMessage } from "@/lib/error-utils";
import type { Json } from "@/integrations/supabase/types";

const statusStyles: Record<string, string> = {
  active: "bg-primary text-primary-foreground",
  completed: "bg-primary/10 text-primary",
  expired: "bg-muted text-muted-foreground",
  rejected: "bg-destructive text-destructive-foreground",
  pending: "bg-accent text-accent-foreground",
};

const filters = ["all", "active", "completed", "expired", "rejected", "pending"];

export default function Ledger() {
  const [filter, setFilter] = useState("all");
  const { data: missions = [], isLoading } = useMissions(filter);
  const { data: stats } = useMissionStats();
  const [exporting, setExporting] = useState(false);
  const [replayMission, setReplayMission] = useState<{ id: string; tether_number: number } | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { data: allMissions, error: mErr } = await supabase
        .from("missions")
        .select("*")
        .order("created_at", { ascending: false });

      if (mErr) throw mErr;

      const { data: allLogs, error: lErr } = await supabase
        .from("execution_log")
        .select("*")
        .order("timestamp", { ascending: true });

      if (lErr) throw lErr;

      const logsByMission: Record<string, ExecutionLogEntry[]> = {};
      for (const log of (allLogs || [])) {
        if (!logsByMission[log.mission_id]) logsByMission[log.mission_id] = [];
        logsByMission[log.mission_id].push(log);
      }

      const totalBlocked = (allLogs || []).filter((l) => l.status === "blocked").length;

      const exportData = {
        exported_at: new Date().toISOString(),
        total_missions: (allMissions || []).length,
        total_actions: (allLogs || []).length,
        total_blocked: totalBlocked,
        missions: (allMissions || []).map((m) => ({
          tether_number: m.tether_number,
          objective: m.objective,
          status: m.status,
          created_at: m.created_at,
          approved_at: m.approved_at,
          risk_level: m.risk_level,
          execution_log: logsByMission[m.id] || [],
        })),
      };

      const blob = new Blob([JSON.stringify(exportData as Json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `tether-audit-export-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: "Export complete", description: `Downloaded ${(allMissions || []).length} missions.` });
    } catch (error: unknown) {
      toast({ title: "Export failed", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, []);

  const statCards = [
    { label: "Total Missions", value: String(stats?.totalMissions ?? 0), color: "text-foreground" },
    { label: "Actions Approved", value: String(stats?.actionsApproved ?? 0), color: "text-primary" },
    { label: "Actions Blocked", value: String(stats?.actionsBlocked ?? 0), color: "text-destructive" },
    { label: "Token Leaks", value: "0", color: "text-primary", icon: Lock },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground">Mission Ledger</h1>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-glass-ghost px-4 py-2 text-sm flex items-center gap-2 self-start disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> {exporting ? "Exporting..." : "Export (JSON)"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="card-tether p-4 animate-card-in">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
              {s.icon && <s.icon className="h-4 w-4 text-primary" />}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === f ? "bg-primary text-primary-foreground" : "btn-glass-ghost"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card-tether overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading missions...</div>
        ) : missions.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No missions found.</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Tether #", "Objective", "Status", "Created", "Time Limit", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {missions.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary font-semibold">#{String(m.tether_number).padStart(3, "0")}</td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate">{m.objective}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${statusStyles[m.status] || ""}`}>{m.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</td>
                      <td className="px-4 py-3 text-xs font-mono">{m.time_limit_mins ? `${m.time_limit_mins} min` : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {(m.status === "completed" || m.status === "expired") && (
                            <button
                              onClick={(e) => { e.preventDefault(); setReplayMission({ id: m.id, tether_number: m.tether_number }); }}
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <Play className="h-3 w-3" /> Replay
                            </button>
                          )}
                          <Link to={`/mission/${m.id}`} className="text-xs text-primary hover:underline">View →</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-border">
              {missions.map((m) => (
                <Link key={m.id} to={`/mission/${m.id}`} className="block px-4 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono text-xs text-primary font-semibold">#{String(m.tether_number).padStart(3, "0")}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${statusStyles[m.status] || ""}`}>{m.status}</span>
                  </div>
                  <p className="text-sm text-foreground line-clamp-2 mb-1">{m.objective}</p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })} · {m.time_limit_mins ? `${m.time_limit_mins} min` : "—"}</p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Replay Modal */}
      {replayMission && (
        <MissionReplay
          open={!!replayMission}
          onOpenChange={(open) => { if (!open) setReplayMission(null); }}
          missionId={replayMission.id}
          tetherNumber={replayMission.tether_number}
        />
      )}
    </div>
  );
}
