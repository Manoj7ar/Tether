import { ShieldCheck, Loader2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useReauthProvider } from "@/hooks/useTokenVault";
import { useMissionStepUpGate, setPendingStepUp, type StepUpProvider } from "@/hooks/useStepUp";
import type { MissionPermission } from "@/hooks/useMissions";

interface StepUpVerificationPanelProps {
  missionId: string;
  permissions: MissionPermission[];
  /** When true, show the full card (mission detail). Mobile approval uses compact copy only. */
  variant?: "card" | "inline";
}

export default function StepUpVerificationPanel({
  missionId,
  permissions,
  variant = "card",
}: StepUpVerificationPanelProps) {
  const location = useLocation();
  const oauthReturnPath = `${location.pathname}${location.search}`;
  const {
    needsStepUp,
    needsGithub,
    needsGoogle,
    githubOk,
    googleOk,
    satisfied: allOk,
    isLoading,
  } = useMissionStepUpGate(missionId, permissions);
  const reauth = useReauthProvider();

  if (!needsStepUp) {
    return null;
  }

  const startReauth = (provider: StepUpProvider) => {
    setPendingStepUp(missionId, provider);
    reauth.mutate({ provider, returnPath: oauthReturnPath });
  };

  const busy = reauth.isPending;

  if (variant === "inline") {
    if (isLoading) {
      return (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking step-up verification…
        </p>
      );
    }
    if (allOk && needsStepUp) {
      return (
        <p className="text-xs text-primary flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" /> Step-up verified. You can approve this mission.
        </p>
      );
    }
    return (
      <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-3 space-y-2">
        <p className="text-xs font-medium text-foreground">Step-up required</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Re-authenticate with the provider for this high-risk mission, then approve.
        </p>
        <div className="flex flex-col gap-2">
          {needsGithub && !githubOk && (
            <button
              type="button"
              disabled={busy}
              onClick={() => startReauth("GitHub")}
              className="btn-glass-ghost py-2.5 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> : null}
              Verify with GitHub
            </button>
          )}
          {needsGoogle && !googleOk && (
            <button
              type="button"
              disabled={busy}
              onClick={() => startReauth("Gmail")}
              className="btn-glass-ghost py-2.5 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" /> : null}
              Verify with Google
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-accent shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">Step-up verification</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            This mission can perform high-impact actions (for example deleting a repository or bulk-reading mail).
            Confirm it is really you by signing in again with the affected provider. Verification expires in 10 minutes.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking verification…
        </p>
      ) : allOk && needsStepUp ? (
        <p className="text-sm text-primary font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Step-up complete. You can approve or run protected actions.
        </p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          {needsGithub && !githubOk && (
            <button
              type="button"
              disabled={busy}
              onClick={() => startReauth("GitHub")}
              className="btn-glass-primary flex-1 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
              Re-authenticate with GitHub
            </button>
          )}
          {needsGoogle && !googleOk && (
            <button
              type="button"
              disabled={busy}
              onClick={() => startReauth("Gmail")}
              className="btn-glass-primary flex-1 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
              Re-authenticate with Google
            </button>
          )}
        </div>
      )}
    </div>
  );
}
