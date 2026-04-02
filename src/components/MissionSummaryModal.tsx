import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useExecutionLog } from "@/hooks/useMissions";
import { Shield, CheckCircle, XCircle, Clock, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceStrict } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mission: {
    id: string;
    tether_number: number;
    objective: string;
    status: string;
    approved_at: string | null;
    completed_at: string | null;
    expires_at: string | null;
  };
}

export default function MissionSummaryModal({ open, onOpenChange, mission }: Props) {
  const { data: logs = [] } = useExecutionLog(mission.id);

  const allowed = logs.filter((l) => l.status === "allowed");
  const blocked = logs.filter((l) => l.status === "blocked");

  // Group allowed actions by type
  const actionCounts: Record<string, number> = {};
  for (const log of allowed) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
  }

  const endTime = mission.completed_at || mission.expires_at;
  const duration = mission.approved_at && endTime
    ? formatDistanceStrict(new Date(mission.approved_at), new Date(endTime))
    : "Unknown";

  const tetherLabel = `#${String(mission.tether_number).padStart(3, "0")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Mission {tetherLabel} Summary
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Objective */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">Objective</p>
            <p className="text-sm text-foreground">{mission.objective}</p>
          </div>

          {/* Duration */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Duration: {duration}</span>
            <span className="ml-auto text-xs uppercase font-semibold px-2 py-0.5 rounded-full bg-muted">
              {mission.status}
            </span>
          </div>

          {/* Actions Summary */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-2">Actions Executed</p>
            {Object.entries(actionCounts).length === 0 ? (
              <p className="text-xs text-muted-foreground">No actions were executed.</p>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(actionCounts).map(([action, count]) => (
                  <div key={action} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-mono text-xs">{action}</span>
                    <span className="text-xs text-muted-foreground ml-auto">×{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blocked */}
          {blocked.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-2">
                Blocked Actions ({blocked.length})
              </p>
              <div className="space-y-1.5">
                {blocked.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex items-start gap-2 text-sm">
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-mono text-xs">{b.action}</span>
                      {b.block_reason && (
                        <p className="text-xs text-muted-foreground">{b.block_reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trust Message */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <p className="text-xs text-foreground">
              Your credentials were never exposed to the agent. All actions were executed through Tether's secure proxy.
            </p>
          </div>

          {/* Ledger Link */}
          <Link
            to="/ledger"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 text-xs text-primary hover:underline"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            View full ledger entry →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
