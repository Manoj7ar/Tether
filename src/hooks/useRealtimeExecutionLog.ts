import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/hooks/useDemoMode";
import type { ExecutionLogEntry } from "@/hooks/useMissions";

export function useRealtimeExecutionLog(missionId?: string) {
  const queryClient = useQueryClient();
  const demo = useDemoMode();
  const [liveEntries, setLiveEntries] = useState<ExecutionLogEntry[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (demo) return;

    const filter = missionId
      ? `mission_id=eq.${missionId}`
      : undefined;

    const channel = supabase
      .channel(`execution-log-${missionId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "execution_log",
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          const newEntry = payload.new as ExecutionLogEntry;
          setLiveEntries((prev) => [newEntry, ...prev]);
          queryClient.invalidateQueries({ queryKey: ["execution_log"] });
          queryClient.invalidateQueries({ queryKey: ["mission_stats"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [missionId, queryClient, demo]);

  const clearLive = () => setLiveEntries([]);

  return { liveEntries, clearLive };
}
