import { useParams, Link } from "react-router-dom";
import MissionManifestCard from "@/components/MissionManifestCard";
import LiveExecutionFeed from "@/components/LiveExecutionFeed";
import RequiredAccounts from "@/components/RequiredAccounts";
import MissionSummaryModal from "@/components/MissionSummaryModal";
import MissionReplay from "@/components/MissionReplay";
import { useMission, useMissionPermissions, useExecutionLog, useUpdateMissionStatus, useConnectedAccounts } from "@/hooks/useMissions";
import { useRealtimeExecutionLog } from "@/hooks/useRealtimeExecutionLog";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Play, FileText, CheckCircle, XCircle, AlertTriangle as TriangleAlert } from "lucide-react";
import { getErrorMessage } from "@/lib/error-utils";
import StepUpVerificationPanel from "@/components/StepUpVerificationPanel";
import { useMissionStepUpGate } from "@/hooks/useStepUp";

interface MissionManifest {
  externalDataExposure?: "low" | "medium" | "high";
  intentVerification?: { reasoning: string; verdict: "passed" | "warning" | "failed" };
  irreversibleActions?: string[];
  scopeNegotiation?: { changes: { downgraded_scope: string; original_scope: string; reason: string }[]; negotiated: boolean };
  willDo?: string[];
  willNotDo?: string[];
}

export default function MissionDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: mission, isLoading } = useMission(id);

  // Realtime subscription: auto-update mission when status changes (e.g. phone approval)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`mission-detail-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "missions", filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["mission", id] });
          queryClient.invalidateQueries({ queryKey: ["missions"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);
  const { data: permissions = [] } = useMissionPermissions(mission?.id);
  const { data: executionLogs = [], isLoading: logsLoading } = useExecutionLog(mission?.id);
  const { liveEntries } = useRealtimeExecutionLog(mission?.id);
  const { data: connectedAccounts = [] } = useConnectedAccounts();
  const updateStatus = useUpdateMissionStatus();
  const { needsStepUp, satisfied: stepUpSatisfied } = useMissionStepUpGate(mission?.id, permissions);

  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mission?.expires_at || mission.status !== "active") {
      setTimeRemaining(null);
      return;
    }

    const calc = () => {
      const expires = new Date(mission.expires_at!);
      const now = new Date();
      const diff = expires.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeRemaining("00:00");
        return true;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
      return false;
    };

    if (calc()) {
      updateStatus.mutateAsync({ id: mission.id, status: "expired" }).catch(() => {
        console.error("Failed to expire mission");
      });
      return;
    }

    const interval = setInterval(() => {
      if (calc()) {
        clearInterval(interval);
        updateStatus.mutateAsync({ id: mission.id, status: "expired" }).catch(() => {
          console.error("Failed to expire mission");
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [mission?.expires_at, mission?.status, mission?.id, updateStatus]);

  // Auto-show summary when mission completes/expires
  useEffect(() => {
    if (mission && prevStatusRef.current === "active" && (mission.status === "completed" || mission.status === "expired")) {
      setShowSummary(true);
    }
    prevStatusRef.current = mission?.status ?? null;
  }, [mission]);

  const mergedLogs = useMemo(() => {
    const seen = new Set<string>();
    const all = [...liveEntries, ...executionLogs];
    return all.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  }, [liveEntries, executionLogs]);

  const [simulating, setSimulating] = useState<string | null>(null);

  const simulateAction = useCallback(async (action: string, params: Record<string, unknown>, label: string) => {
    if (!mission) return;
    setSimulating(label);
    try {
      const { data, error } = await supabase.functions.invoke("agent-action", {
        body: { mission_id: mission.id, action, params },
      });
      if (error) {
        toast({ title: "Blocked", description: error.message, variant: "destructive" });
      } else if (data?.allowed) {
        toast({ title: "Allowed", description: `${action} — approved by Tether` });
      } else {
        toast({ title: "Blocked", description: data?.error || "Action blocked", variant: "destructive" });
      }
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setSimulating(null);
    }
  }, [mission]);

  const simulateCompromised = useCallback(async () => {
    if (!mission) return;
    setSimulating("compromised");
    const attacks = [
      { action: "gmail.send_email", params: { to: "attacker@gmail.com", subject: "Stolen data", body: "Attempted exfiltration." }, label: "Send External Email" },
      { action: "github.delete_repo", params: { repo: "acme/backend" }, label: "Delete Repository" },
      { action: "gmail.download_all", params: {}, label: "Download All Mail" },
    ];
    for (const atk of attacks) {
      await simulateAction(atk.action, atk.params, atk.label);
      await new Promise((r) => setTimeout(r, 500));
    }
    setSimulating(null);
  }, [mission, simulateAction]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-8">
        <div className="card-tether p-12 text-center text-sm text-muted-foreground">Loading mission...</div>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="max-w-3xl mx-auto p-6 lg:p-8">
        <div className="card-tether p-12 text-center">
          <h2 className="font-display text-xl font-semibold text-foreground mb-2">Mission not found</h2>
          <p className="text-sm text-muted-foreground">This mission may have been deleted or you don't have access to it.</p>
        </div>
      </div>
    );
  }

  const manifest = mission.manifest_json as MissionManifest | null;
  const manifestForCard = manifest ? {
    tetherNumber: String(mission.tether_number).padStart(3, "0"),
    createdAt: format(new Date(mission.created_at), "MMM d yyyy 'at' HH:mm"),
    expiryLabel: `${mission.time_limit_mins || 30} minutes from approval`,
    objective: mission.objective,
    permissions: permissions.map((p) => ({
      provider: p.provider,
      scope: p.scope,
      actionType: p.action_type as "read" | "write",
    })),
    willDo: (manifest.willDo as string[]) || [],
    willNotDo: (manifest.willNotDo as string[]) || [],
    riskLevel: (mission.risk_level as "low" | "medium" | "high") || "low",
    irreversibleActions: (manifest.irreversibleActions as string[]) || [],
    externalDataExposure: (manifest.externalDataExposure as "low" | "medium" | "high") || "low",
    intentVerification: (manifest.intentVerification as { verdict: "passed" | "warning" | "failed"; reasoning: string }) || {
      verdict: "passed" as const,
      reasoning: "No audit data available.",
    },
    scopeNegotiation: manifest.scopeNegotiation || undefined,
  } : null;

  const handleStatusChange = async (status: string) => {
    try {
      await updateStatus.mutateAsync({ id: mission.id, status });
      toast({ title: `Mission ${status}`, description: `Tether #${String(mission.tether_number).padStart(3, "0")} has been ${status}.` });
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const isFinished = mission.status === "completed" || mission.status === "expired";

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-8 space-y-6">
      {/* Status Banner */}
      <div className={`rounded-xl px-6 py-4 flex items-center gap-3 ${
        mission.status === "active" ? "bg-primary/10" :
        mission.status === "pending" ? "bg-accent/10" :
        mission.status === "completed" ? "bg-primary/5" :
        "bg-muted"
      }`}>
        <span className={`h-2.5 w-2.5 rounded-full ${
          mission.status === "active" ? "bg-primary animate-pulse" :
          mission.status === "pending" ? "bg-accent animate-pulse" :
          "bg-muted-foreground"
        }`} />
        <span className="text-sm font-medium">
          {mission.status === "active" && `Agent is authorized to act · Expires in ${timeRemaining || "—"}`}
          {mission.status === "pending" && "Awaiting approval"}
          {mission.status === "completed" && "Mission completed"}
          {mission.status === "expired" && "Mission expired"}
          {mission.status === "rejected" && "Mission rejected"}
        </span>

        {mission.status === "active" && liveEntries.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Summary + Replay buttons for finished missions */}
      {isFinished && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowSummary(true)}
            className="btn-glass-ghost flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <FileText className="h-4 w-4" /> View Summary
          </button>
          <button
            onClick={() => setShowReplay(true)}
            className="btn-glass-ghost flex-1 py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <Play className="h-4 w-4" /> Replay Mission
          </button>
        </div>
      )}

      {/* Approval buttons for pending missions */}
      {mission.status === "pending" && (
        <div className="space-y-4">
          <StepUpVerificationPanel missionId={mission.id} permissions={permissions} variant="card" />
          <div className="flex gap-3">
          <button
            onClick={() => handleStatusChange("active")}
            disabled={updateStatus.isPending || (needsStepUp && !stepUpSatisfied)}
            className="btn-glass-primary flex-1 py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle className="h-4 w-4" /> Approve Mission
          </button>
          <button
            onClick={() => handleStatusChange("rejected")}
            disabled={updateStatus.isPending}
            className="btn-glass-destructive flex-1 py-3 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <XCircle className="h-4 w-4" /> Reject Mission
          </button>
          </div>
        </div>
      )}

      {/* Agent Simulation Panel */}
      {mission.status === "active" && (
        <div className="rounded-xl border-2 border-dashed border-primary/40 p-5 space-y-4">
          <p className="text-xs font-mono text-primary uppercase tracking-wider">Agent Simulation Panel</p>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Simulate Agent Actions (should be allowed):</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => simulateAction("github.list_issues", { repo: "acme/backend" }, "read-issues")} disabled={!!simulating} className="btn-glass-ghost px-3 py-2 text-xs border-primary/30 text-primary disabled:opacity-50">Simulate: Read Issues</button>
              <button onClick={() => simulateAction("calendar.list_events", {}, "read-calendar")} disabled={!!simulating} className="btn-glass-ghost px-3 py-2 text-xs border-primary/30 text-primary disabled:opacity-50">Simulate: Read Calendar</button>
              <button onClick={() => simulateAction("gmail.send_email", { to: "team@company.com", subject: "Weekly standup summary", body: "Weekly standup summary generated by Tether." }, "send-internal")} disabled={!!simulating} className="btn-glass-ghost px-3 py-2 text-xs border-primary/30 text-primary disabled:opacity-50">Simulate: Send Internal Email</button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Simulate Violations (should be blocked):</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => simulateAction("gmail.send_email", { to: "attacker@gmail.com", subject: "Stolen data", body: "Exfiltration attempt." }, "ext-email")} disabled={!!simulating} className="btn-glass-ghost px-3 py-2 text-xs border-destructive/30 text-destructive disabled:opacity-50">Send External Email</button>
              <button onClick={() => simulateAction("github.delete_repo", { repo: "acme/backend" }, "delete-repo")} disabled={!!simulating} className="btn-glass-ghost px-3 py-2 text-xs border-destructive/30 text-destructive disabled:opacity-50">Delete Repository</button>
              <button onClick={() => simulateAction("gmail.download_all", {}, "download-mail")} disabled={!!simulating} className="btn-glass-ghost px-3 py-2 text-xs border-destructive/30 text-destructive disabled:opacity-50">Download All Mail</button>
            </div>
          </div>

          <button onClick={simulateCompromised} disabled={!!simulating} className="w-full py-3 rounded-xl text-sm font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <TriangleAlert className="h-4 w-4" />
            {simulating === "compromised" ? "Simulating Attack..." : "Simulate Compromised Agent"}
          </button>
        </div>
      )}

      {/* Required Accounts */}
      {permissions.length > 0 && (
        <RequiredAccounts permissions={permissions} connectedAccounts={connectedAccounts} />
      )}

      {manifestForCard && <MissionManifestCard manifest={manifestForCard} />}

      {/* Real-time Execution Log */}
      <div>
        <h2 className="font-medium text-foreground mb-3 flex items-center gap-2">
          Execution Log
          {liveEntries.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
              {liveEntries.length} new
            </span>
          )}
        </h2>
        <LiveExecutionFeed
          entries={mergedLogs}
          isEmpty={mergedLogs.length === 0}
          isLoading={logsLoading}
        />
      </div>

      {/* Complete / Revoke */}
      {mission.status === "active" && (
        <button
          onClick={() => handleStatusChange("completed")}
          disabled={updateStatus.isPending}
          className="btn-glass-ghost w-full py-3 text-sm disabled:opacity-50"
        >
          Complete Mission
        </button>
      )}

      {/* Modals */}
      <MissionSummaryModal
        open={showSummary}
        onOpenChange={setShowSummary}
        mission={mission}
      />
      <MissionReplay
        open={showReplay}
        onOpenChange={setShowReplay}
        missionId={mission.id}
        tetherNumber={mission.tether_number}
      />
    </div>
  );
}
