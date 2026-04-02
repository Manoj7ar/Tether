import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  useCompleteStepUp,
  readPendingStepUp,
  clearPendingStepUp,
} from "@/hooks/useStepUp";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error-utils";

/**
 * After Auth0 OAuth redirect, completes step-up if sessionStorage has a pending mission.
 * Lives inside the router so any return path (mission detail, /approve, /accounts) works.
 */
export default function StepUpOAuthReturn() {
  const location = useLocation();
  const completeStepUp = useCompleteStepUp();
  const attemptKey = useRef<string | null>(null);

  useEffect(() => {
    const pending = readPendingStepUp();
    if (!pending) {
      attemptKey.current = null;
      return;
    }

    const key = `${pending.missionId}:${pending.provider}:${location.pathname}`;
    if (attemptKey.current === key) return;
    attemptKey.current = key;

    completeStepUp.mutate(
      { missionId: pending.missionId, provider: pending.provider },
      {
        onSuccess: () => {
          clearPendingStepUp();
          attemptKey.current = null;
          toast({ title: "Step-up verified", description: "You can approve or run protected actions." });
        },
        onError: (err) => {
          clearPendingStepUp();
          attemptKey.current = null;
          toast({
            title: "Step-up confirmation failed",
            description: getErrorMessage(err),
            variant: "destructive",
          });
        },
      },
    );
  }, [location.pathname, location.search, completeStepUp]);

  return null;
}
