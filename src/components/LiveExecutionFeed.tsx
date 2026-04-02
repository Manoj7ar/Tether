import { format } from "date-fns";
import { Activity, Zap, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ExecutionLogEntry } from "@/hooks/useMissions";

interface LiveExecutionFeedProps {
  /** Combined entries: live (realtime) merged with initial query data */
  entries: ExecutionLogEntry[];
  /** Whether there are no entries at all (including from initial load) */
  isEmpty: boolean;
  isLoading?: boolean;
}

export default function LiveExecutionFeed({ entries, isEmpty, isLoading }: LiveExecutionFeedProps) {
  if (isLoading) {
    return (
      <div className="card-tether p-8 text-center text-sm text-muted-foreground">
        Loading execution log...
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="card-tether p-8 text-center">
        <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No execution logs yet. Actions will stream here in real-time.</p>
      </div>
    );
  }

  return (
    <div className="card-tether overflow-hidden">
      <div className="divide-y divide-border">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`px-3 sm:px-4 py-3 text-sm ${
                entry.status === "blocked"
                  ? "bg-destructive/5 border-l-2 border-l-destructive"
                  : ""
              }`}
            >
              {/* Mobile layout: stacked */}
              <div className="flex items-start gap-2 sm:gap-4">
                {/* Icon */}
                <span className="shrink-0 pt-0.5">
                  {entry.status === "blocked" ? (
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 text-primary" />
                  )}
                </span>

                <div className="flex-1 min-w-0">
                  {/* Top row: action + status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-foreground truncate max-w-[180px] sm:max-w-none">
                      {entry.action}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        entry.status === "allowed"
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {entry.status === "allowed" ? "ALLOWED" : "BLOCKED"}
                    </span>
                  </div>
                  {/* Bottom row: timestamp + summary */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      {format(new Date(entry.timestamp), "HH:mm:ss")}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {entry.result_summary || entry.block_reason || "—"}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
