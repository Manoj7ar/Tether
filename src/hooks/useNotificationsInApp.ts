import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { DEMO_NOTIFICATIONS } from "@/lib/demo-data";
import { toast } from "sonner";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  mission_id: string | null;
  read: boolean;
  created_at: string;
}

export function useNotificationsInApp() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const demo = useDemoMode();

  const query = useQuery({
    queryKey: ["notifications", demo],
    queryFn: async () => {
      if (demo) return DEMO_NOTIFICATIONS as unknown as Notification[];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    enabled: !!user,
  });

  const unreadCount = (query.data ?? []).filter((n) => !n.read).length;

  useEffect(() => {
    if (!user || demo) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as Notification;
          if (newNotif.user_id === user.id) {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            toast(newNotif.title, { description: newNotif.body ?? undefined });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, demo]);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      if (demo) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (demo) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return { ...query, unreadCount, markAsRead, markAllRead };
}
