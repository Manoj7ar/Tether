import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAppConfig, isStubAuthMode } from "@/lib/env";
import type { MissionPermission } from "@/hooks/useMissions";
import {
  getCapableActionIdsFromPermissions,
  missionRequiresStepUpApproval,
} from "../../shared/mission-actions";

export type StepUpProvider = "GitHub" | "Gmail" | "Google Calendar" | "Slack";

function functionsBaseUrl(): string {
  const { supabaseProjectId, supabaseUrl } = getAppConfig();
  if (supabaseProjectId) {
    return `https://${supabaseProjectId}.supabase.co/functions/v1`;
  }
  return `${supabaseUrl}/functions/v1`;
}

export interface StepUpVerification {
  github_verified_at: string | null;
  google_verified_at: string | null;
  expires_at: string;
}

const STEP_UP_SESSION_KEY = "tether:pending_step_up";

export type PendingStepUp = { missionId: string; provider: StepUpProvider };

export function readPendingStepUp(): PendingStepUp | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STEP_UP_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingStepUp;
  } catch {
    return null;
  }
}

export function clearPendingStepUp() {
  sessionStorage.removeItem(STEP_UP_SESSION_KEY);
}

export function setPendingStepUp(missionId: string, provider: StepUpProvider) {
  sessionStorage.setItem(STEP_UP_SESSION_KEY, JSON.stringify({ missionId, provider }));
}

export function useStepUpStatus(missionId: string | undefined) {
  const { getAccessToken } = useAuth();

  return useQuery({
    queryKey: ["step_up_status", missionId],
    queryFn: async (): Promise<StepUpVerification | null> => {
      if (!missionId) return null;
      const token = await getAccessToken();
      const url = new URL(`${functionsBaseUrl()}/step-up-status`);
      url.searchParams.set("mission_id", missionId);

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: getAppConfig().supabasePublishableKey,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Step-up status failed");
      }

      return (data.verification as StepUpVerification | null) ?? null;
    },
    enabled: !!missionId && !isStubAuthMode(),
    refetchInterval: 15_000,
  });
}

export function useMissionStepUpGate(missionId: string | undefined, permissions: MissionPermission[]) {
  const stub = isStubAuthMode();

  const capableIds = useMemo(
    () =>
      getCapableActionIdsFromPermissions(
        permissions.map((p) => ({ provider: p.provider, scope: p.scope })),
      ),
    [permissions],
  );

  const needsStepUpRaw = missionRequiresStepUpApproval(capableIds);
  const needsGithubRaw = capableIds.includes("github.delete_repo");
  const needsGoogleRaw = capableIds.includes("gmail.download_all");

  const { data: verification, isLoading } = useStepUpStatus(stub ? undefined : missionId);

  const needsStepUp = stub ? false : needsStepUpRaw;
  const needsGithub = stub ? false : needsGithubRaw;
  const needsGoogle = stub ? false : needsGoogleRaw;

  const githubOk = stub || !needsGithubRaw || Boolean(verification?.github_verified_at);
  const googleOk = stub || !needsGoogleRaw || Boolean(verification?.google_verified_at);

  const satisfied = stub || !needsStepUpRaw || (githubOk && googleOk);

  return {
    needsStepUp,
    needsGithub,
    needsGoogle,
    githubOk,
    googleOk,
    satisfied,
    isLoading: stub ? false : isLoading,
    verification: stub ? null : verification,
  };
}

export function useCompleteStepUp() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();

  return useMutation({
    mutationFn: async (input: { missionId: string; provider: StepUpProvider }) => {
      const token = await getAccessToken();
      const res = await fetch(`${functionsBaseUrl()}/step-up-complete`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: getAppConfig().supabasePublishableKey,
        },
        body: JSON.stringify({ missionId: input.missionId, provider: input.provider }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Step-up failed");
      }

      return data as { success: boolean; expires_at: string };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["step_up_status", vars.missionId] });
    },
  });
}
