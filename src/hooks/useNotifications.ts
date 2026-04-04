import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { callEdgeFn } from "@/lib/edge-call";
import type { Mission } from "@/hooks/useMissions";

function currentPermission(): NotificationPermission {
  return typeof window !== "undefined" && "Notification" in window ? Notification.permission : "denied";
}

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>(currentPermission);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return "denied" as const;
    if (Notification.permission === "granted") return "granted" as const;
    if (Notification.permission === "denied") return "denied" as const;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return {
    supported: typeof window !== "undefined" && "Notification" in window,
    permission,
    requestPermission,
  };
}

export function useMissionNotifications() {
  const { user } = useAuth();
  const demo = useDemoMode();
  const notifiedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!user || demo) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const channel = supabase
      .channel("mission-notifications")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "missions",
          filter: `status=eq.active`,
        },
        (payload) => {
          const mission = payload.new as Mission;
          if (mission.user_id !== user.id) return;
          if (notifiedRef.current.has(mission.id)) return;
          notifiedRef.current.add(mission.id);

          const tetherNum = String(mission.tether_number).padStart(3, "0");

          new Notification(`Tether #${tetherNum} — Mission Launched`, {
            body: mission.objective?.slice(0, 120) || "Your mission is now active.",
            icon: "/favicon.svg",
            tag: `mission-${mission.id}`,
            data: { url: `/mission/${mission.id}` },
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, demo]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushSubscription(notificationPermission?: NotificationPermission) {
  const { user, getAccessToken, isAuthenticated } = useAuth();
  const demo = useDemoMode();
  const subscribedRef = useRef(false);
  const [subscribed, setSubscribed] = useState(false);
  const perm = notificationPermission ?? currentPermission();
  const attemptRef = useRef(0);

  useEffect(() => {
    if (demo) return;
    if (!isAuthenticated || !user) return;
    if (subscribedRef.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (perm !== "granted") return;

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

    let cancelled = false;
    attemptRef.current++;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        let sub = await registration.pushManager.getSubscription();

        if (!sub) {
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
        }

        if (cancelled) return;

        await callEdgeFn(getAccessToken, {
          functionName: "push-subscribe",
          body: { subscription: sub!.toJSON() },
        });

        if (!cancelled) {
          subscribedRef.current = true;
          setSubscribed(true);
        }
      } catch (e) {
        console.error("Push subscription error:", e);
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated, user, getAccessToken, perm, demo]);

  return { subscribed };
}
