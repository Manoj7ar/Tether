import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";
import SwipeToConfirm from "@/components/ui/SwipeToConfirm";
import MissionManifestCard from "@/components/mission/MissionManifestCard";
import { useCreateMission, useUpdateMissionStatus } from "@/hooks/useMissions";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { toast } from "@/hooks/use-toast";
import { callEdgeFn } from "@/lib/edge-call";
import { buildDemoManifest } from "@/lib/demo-data";
import MissionTemplates, { MissionTemplate } from "@/components/mission/MissionTemplates";
import { getErrorMessage } from "@/lib/error-utils";
import StepUpVerificationPanel from "@/components/security/StepUpVerificationPanel";
import type { MissionPermission } from "@/hooks/useMissions";

interface ManifestData {
  tetherNumber: string;
  createdAt: string;
  expiryLabel: string;
  objective: string;
  permissions: { provider: string; scope: string; actionType: "read" | "write" }[];
  willDo: string[];
  willNotDo: string[];
  riskLevel: "low" | "medium" | "high";
  irreversibleActions: string[];
  externalDataExposure: "low" | "medium" | "high";
  intentVerification: { verdict: "passed" | "warning" | "failed"; reasoning: string };
  scopeNegotiation?: { negotiated: boolean; changes: { original_scope: string; downgraded_scope: string; reason: string }[] };
}

export default function NewMission() {
  const [task, setTask] = useState("");
  const [timeLimit, setTimeLimit] = useState(30);
  const [manifest, setManifest] = useState<ManifestData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [stepUpMissionId, setStepUpMissionId] = useState<string | null>(null);
  const [stepUpPermissions, setStepUpPermissions] = useState<MissionPermission[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const createMission = useCreateMission();
  const updateStatus = useUpdateMissionStatus();
  const { getAccessToken } = useAuth();
  const isDemoMode = useDemoMode();

  // Pre-fill from navigation state (Quick Launch on Dashboard)
  useEffect(() => {
    const state = location.state as { objective?: string; timeLimit?: number } | null;
    if (state?.objective) setTask(state.objective);
    if (state?.timeLimit) setTimeLimit(state.timeLimit);
  }, [location.state]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      if (isDemoMode) {
        const demo = buildDemoManifest(task, timeLimit);
        setManifest(demo.manifest as ManifestData);
      } else {
        const data = await callEdgeFn(getAccessToken, {
          functionName: "generate-manifest",
          body: { task, timeLimitMins: timeLimit },
        });
        setManifest((data as { manifest: ManifestData }).manifest);
      }
    } catch (error: unknown) {
      toast({ title: "Failed to generate manifest", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleLaunchMission = async () => {
    if (!manifest) return;
    setLaunching(true);
    setStepUpMissionId(null);

    try {
      if (isDemoMode) {
        const fakeId = crypto.randomUUID();
        const fakeTetherNum = String(Math.floor(Math.random() * 900) + 100);
        const now = new Date();
        const fakeMission = {
          id: fakeId,
          tether_number: Number(fakeTetherNum),
          objective: manifest.objective,
          status: "active" as const,
          time_limit_mins: timeLimit,
          risk_level: manifest.riskLevel,
          manifest_json: manifest as unknown as Record<string, unknown>,
          created_at: now.toISOString(),
          approved_at: now.toISOString(),
          expires_at: new Date(now.getTime() + timeLimit * 60000).toISOString(),
          user_id: "demo",
        };

        sessionStorage.setItem(`demo_mission_${fakeId}`, JSON.stringify(fakeMission));
        toast({ title: "Mission launched", description: `Tether #${fakeTetherNum} is now active.` });
        navigate(`/mission/${fakeId}`);
        return;
      }

      const mission = await createMission.mutateAsync({
        objective: manifest.objective,
        time_limit_mins: timeLimit,
        risk_level: manifest.riskLevel,
        manifest_json: manifest as unknown as Record<string, unknown>,
        intent_audit: manifest.intentVerification as unknown as Record<string, unknown>,
        permissions: manifest.permissions.map((p) => ({
          provider: p.provider,
          scope: p.scope,
          action_type: p.actionType,
        })),
      });

      try {
        await updateStatus.mutateAsync({ id: mission.id, status: "active" });
      } catch (approveErr: unknown) {
        const msg = getErrorMessage(approveErr);
        if (/step.up.required|step_up_required/i.test(msg)) {
          setStepUpMissionId(mission.id);
          setStepUpPermissions(
            manifest.permissions.map((p, i) => ({
              id: `perm-${i}`,
              mission_id: mission.id,
              provider: p.provider,
              scope: p.scope,
              action_type: p.actionType,
              reason: null,
              created_at: new Date().toISOString(),
            })) as MissionPermission[],
          );
          toast({ title: "Step-up required", description: "Re-authenticate with the provider, then swipe again to launch." });
          return;
        }
        throw approveErr;
      }

      const num = String(mission.tether_number).padStart(3, "0");
      toast({ title: "Mission launched", description: `Tether #${num} is now active.` });
      navigate(`/mission/${mission.id}`);
    } catch (error: unknown) {
      toast({ title: "Error launching mission", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  };

  const handleRetryAfterStepUp = async () => {
    if (!stepUpMissionId) return;
    setLaunching(true);
    try {
      await updateStatus.mutateAsync({ id: stepUpMissionId, status: "active" });
      toast({ title: "Mission launched", description: "Step-up verified. Your agent is active." });
      navigate(`/mission/${stepUpMissionId}`);
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-8">
      {!manifest ? (
        <div className="animate-card-in">
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Create a New Mission</h1>
          <p className="text-muted-foreground mb-6">
            Describe what you need your agent to do, or pick a template below.
          </p>

          <div className="mb-6">
            <h2 className="text-sm font-medium text-foreground mb-3">Quick Templates</h2>
            <MissionTemplates onSelect={(t: MissionTemplate) => { setTask(t.objective); setTimeLimit(t.timeLimit); }} />
          </div>

          <div className="card-tether p-6 space-y-5">
            <Textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g. Triage my open GitHub issues, check my calendar for this week, and send a summary email to team@company.com for Monday's standup"
              className="min-h-[140px] resize-none border-border focus:ring-primary"
            />

            <div>
              <label className="text-sm font-medium text-foreground block mb-2">Mission time limit</label>
              <div className="flex gap-2">
                {[15, 30, 60].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeLimit(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      timeLimit === t
                        ? "bg-primary text-primary-foreground"
                        : "btn-glass-ghost"
                    }`}
                  >
                    {t === 60 ? "1 hour" : `${t} min`}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!task.trim() || generating}
              className="btn-glass-primary w-full py-3.5 text-base disabled:opacity-50"
            >
              {generating ? "Generating Manifest..." : <><Sparkles className="h-4 w-4 inline mr-1" /> Generate Manifest</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-card-in">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-3xl font-bold text-foreground">Mission Manifest</h1>
            <button onClick={() => setManifest(null)} className="btn-glass-ghost px-4 py-2 text-sm">
              ← Edit Task
            </button>
          </div>

          <MissionManifestCard manifest={manifest} />

          {stepUpMissionId && (
            <StepUpVerificationPanel
              missionId={stepUpMissionId}
              permissions={stepUpPermissions}
              variant="card"
            />
          )}

          <SwipeToConfirm
            onConfirm={stepUpMissionId ? handleRetryAfterStepUp : handleLaunchMission}
            loading={launching}
            disabled={createMission.isPending}
            label={stepUpMissionId ? "Slide to Retry Launch" : "Slide to Launch Mission"}
          />
        </div>
      )}
    </div>
  );
}
