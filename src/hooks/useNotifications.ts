import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Mission } from "@/hooks/useMissions";

export function useNotificationPermission() {
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return await Notification.requestPermission();
  }, []);

  return {
    supported: typeof window !== "undefined" && "Notification" in window,
    permission: typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied",
    requestPermission,
  };
}

export function useMissionNotifications() {
  const { user } = useAuth();
  const notifiedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!user) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const channel = supabase
      .channel("mission-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "missions",
          filter: `status=eq.pending`,
        },
        (payload) => {
          const mission = payload.new as Mission;
          // Only notify for this user's missions and avoid duplicates
          if (mission.user_id !== user.id) return;
          if (notifiedRef.current.has(mission.id)) return;
          notifiedRef.current.add(mission.id);

          const tetherNum = String(mission.tether_number).padStart(3, "0");

          new Notification(`Tether #${tetherNum} — Approval Required`, {
            body: mission.objective?.slice(0, 120) || "A new mission needs your approval.",
            icon: "/favicon.svg",
            tag: `mission-${mission.id}`,
            data: { url: `/approve?mission=${mission.id}` },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
