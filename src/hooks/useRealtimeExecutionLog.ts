import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ExecutionLogEntry } from "@/hooks/useMissions";

/**
 * Subscribe to realtime execution_log inserts.
 * Optionally filter by missionId.
 * Returns the latest entries streamed in (newest first).
 */
export function useRealtimeExecutionLog(missionId?: string) {
  const queryClient = useQueryClient();
  const [liveEntries, setLiveEntries] = useState<ExecutionLogEntry[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
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

          // Also invalidate react-query caches so non-realtime consumers stay fresh
          queryClient.invalidateQueries({ queryKey: ["execution_log"] });
          queryClient.invalidateQueries({ queryKey: ["mission_stats"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [missionId, queryClient]);

  const clearLive = () => setLiveEntries([]);

  return { liveEntries, clearLive };
}
