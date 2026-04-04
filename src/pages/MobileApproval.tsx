import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import TetherLogo from "@/components/layout/TetherLogo";
import { useAuth } from "@/hooks/useAuth";
import { useMissionPermissions, useUpdateMissionStatus, type Mission } from "@/hooks/useMissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error-utils";
import StepUpVerificationPanel from "@/components/security/StepUpVerificationPanel";
import { useMissionStepUpGate } from "@/hooks/useStepUp";

interface MissionManifest {
  intentVerification?: { reasoning: string; verdict: "passed" | "warning" | "failed" };
  irreversibleActions?: string[];
  willDo?: string[];
}

function usePendingMissionForApproval() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const missionIdParam = searchParams.get("mission");
  const queryClient = useQueryClient();

  // Subscribe to realtime changes on missions table
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("mobile-approval-missions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "missions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pending_approval_mission"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return useQuery({
    queryKey: ["pending_approval_mission", missionIdParam],
    queryFn: async (): Promise<Mission | null> => {
      if (missionIdParam) {
        const { data, error } = await supabase
          .from("missions")
          .select("*")
          .eq("id", missionIdParam)
          .eq("status", "pending")
          .maybeSingle();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase
        .from("missions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

type ScreenState = "waiting" | "pending" | "approved" | "rejected";

export default function MobileApproval() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: pendingMission, isLoading } = usePendingMissionForApproval();
  const { data: permissions = [] } = useMissionPermissions(pendingMission?.id);
  const updateStatus = useUpdateMissionStatus();
  const { needsStepUp, satisfied: stepUpSatisfied } = useMissionStepUpGate(
    pendingMission?.id,
    permissions,
  );
  const [screenState, setScreenState] = useState<ScreenState>("waiting");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true, state: { returnTo: "/approve" } });
    }
  }, [authLoading, user, navigate]);
  // Sync screen state with data
  useEffect(() => {
    if (pendingMission) {
      setScreenState("pending");
    } else if (!isLoading) {
      // Only show waiting if we're not in a post-action state
      if (screenState !== "approved" && screenState !== "rejected") {
        setScreenState("waiting");
      }
    }
  }, [pendingMission, isLoading, screenState]);

  const manifest = pendingMission?.manifest_json as MissionManifest | null;
  const willDo = (manifest?.willDo as string[]) || [];
  const irreversibleActions = (manifest?.irreversibleActions as string[]) || [];
  const riskLevel = (pendingMission?.risk_level as string) || "low";
  const intentVerification = manifest?.intentVerification as { verdict: string; reasoning: string } | undefined;
  const tetherNumber = pendingMission ? String(pendingMission.tether_number).padStart(3, "0") : "—";

  const handleApprove = async () => {
    if (!pendingMission) return;
    try {
      await updateStatus.mutateAsync({ id: pendingMission.id, status: "active" });
      setScreenState("approved");
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!pendingMission) return;
    try {
      await updateStatus.mutateAsync({ id: pendingMission.id, status: "rejected" });
      setScreenState("rejected");
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading approval console...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (screenState === "approved") {
    return (
      <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-6 text-center">
        <div className="text-7xl mb-6 animate-card-in">✓</div>
        <h1 className="font-display text-3xl font-bold text-primary-foreground mb-3">Mission Approved</h1>
        <p className="text-primary-foreground/80 text-sm">
          Your agent may now proceed. Access expires in {pendingMission?.time_limit_mins || 30} minutes.
        </p>
        <button
          onClick={() => setScreenState("waiting")}
          className="mt-8 text-sm text-primary-foreground/60 hover:text-primary-foreground underline"
        >
          Back to waiting
        </button>
      </div>
    );
  }

  if (screenState === "rejected") {
    return (
      <div className="min-h-screen bg-destructive flex flex-col items-center justify-center px-6 text-center">
        <div className="text-7xl mb-6 animate-card-in">✗</div>
        <h1 className="font-display text-3xl font-bold text-destructive-foreground mb-3">Mission Rejected</h1>
        <p className="text-destructive-foreground/80 text-sm">Your agent has been notified. No actions will be taken.</p>
        <button
          onClick={() => setScreenState("waiting")}
          className="mt-8 text-sm text-destructive-foreground/60 hover:text-destructive-foreground underline"
        >
          Back to waiting
        </button>
      </div>
    );
  }

  if (screenState === "waiting" || !pendingMission) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-6">
          <TetherLogo size="lg" />
        </div>
        <div className="relative mb-6">
          <div className="h-16 w-16 rounded-full border-2 border-primary/30 animate-pulse-status" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-primary/10" />
          </div>
        </div>
        <p className="text-foreground font-medium mb-1">No pending approvals</p>
        <p className="text-sm text-muted-foreground">This page will update automatically when a mission needs approval.</p>
      </div>
    );
  }

  // Pending approval state
  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
        <p className="font-mono text-sm text-primary font-semibold mb-4">TETHER #{tetherNumber}</p>
        <div className="h-px bg-border mb-6" />

        <h2 className="font-display text-xl font-bold text-foreground mb-4">
          Your agent is requesting permission to act.
        </h2>

        <p className="text-sm text-muted-foreground mb-6 line-clamp-3">{pendingMission.objective}</p>

        {willDo.length > 0 && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">What it will do</p>
            <ul className="space-y-2">
              {willDo.map((item, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-primary">•</span> {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {irreversibleActions.length > 0 && (
          <div className="rounded-lg bg-accent/10 px-4 py-3 mb-6">
            <p className="text-sm font-medium text-accent flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 inline mr-1" /> Includes irreversible action{irreversibleActions.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{irreversibleActions.join(", ")}</p>
          </div>
        )}

        <div className="space-y-2 mb-6 text-sm">
          <p className="flex items-center gap-2">
            <span className="text-muted-foreground">Risk level:</span>
            <span className={`font-semibold uppercase ${
              riskLevel === "high" ? "text-destructive" :
              riskLevel === "medium" ? "text-accent" : "text-primary"
            }`}>
              ● {riskLevel}
            </span>
          </p>
          {intentVerification && (
            <p className="flex items-center gap-2">
              <span className="text-muted-foreground">Intent verified:</span>
              <span className={`font-semibold ${
                intentVerification.verdict === "passed" ? "text-primary" :
                intentVerification.verdict === "warning" ? "text-accent" : "text-destructive"
              }`}>
                {intentVerification.verdict === "passed" ? <CheckCircle className="h-4 w-4 inline mr-1" /> : intentVerification.verdict === "warning" ? <AlertTriangle className="h-4 w-4 inline mr-1" /> : <XCircle className="h-4 w-4 inline mr-1" />} AI audit {intentVerification.verdict}
              </span>
            </p>
          )}
          <p className="flex items-center gap-2">
            <span className="text-muted-foreground">Time limit:</span>
            <span className="font-mono font-semibold text-foreground">
              {pendingMission.time_limit_mins || 30} min
            </span>
          </p>
        </div>

        {permissions.length > 0 && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-2">Permissions</p>
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((p) => (
                <span
                  key={p.id}
                  className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    p.action_type === "write" ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                  }`}
                >
                  {p.provider}.{p.scope}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="h-px bg-border mb-6" />

        {pendingMission && (
          <div className="mb-6">
            <StepUpVerificationPanel
              missionId={pendingMission.id}
              permissions={permissions}
              variant="inline"
            />
          </div>
        )}

        <button
          onClick={handleApprove}
          disabled={updateStatus.isPending || (needsStepUp && !stepUpSatisfied)}
          className="btn-glass-primary w-full py-4 text-base mb-3 disabled:opacity-50"
          style={{ minHeight: 64 }}
        >
          {updateStatus.isPending ? "Processing..." : "APPROVE MISSION"}
        </button>
        <button
          onClick={handleReject}
          disabled={updateStatus.isPending}
          className="btn-glass-destructive w-full py-3.5 text-base border border-destructive/20 disabled:opacity-50"
          style={{ minHeight: 52 }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
