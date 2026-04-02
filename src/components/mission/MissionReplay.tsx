import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useExecutionLog } from "@/hooks/useMissions";
import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missionId: string;
  tetherNumber: number;
}

export default function MissionReplay({ open, onOpenChange, missionId, tetherNumber }: Props) {
  const { data: logs = [] } = useExecutionLog(missionId);
  const [currentStep, setCurrentStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= sortedLogs.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, sortedLogs.length]);

  const handlePlay = () => {
    if (currentStep >= sortedLogs.length - 1) setCurrentStep(-1);
    setPlaying(true);
  };

  const handleReset = () => {
    setPlaying(false);
    setCurrentStep(-1);
  };

  const progress = sortedLogs.length > 0 ? ((currentStep + 1) / sortedLogs.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setPlaying(false); handleReset(); } onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">
            Mission Replay — Tether #{String(tetherNumber).padStart(3, "0")}
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {playing ? (
            <button onClick={() => setPlaying(false)} className="btn-glass-ghost px-3 py-1.5 text-xs flex items-center gap-1.5">
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
          ) : (
            <button onClick={handlePlay} className="btn-glass-primary px-3 py-1.5 text-xs flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5" /> {currentStep >= sortedLogs.length - 1 ? "Replay" : "Play"}
            </button>
          )}
          <button onClick={handleReset} className="btn-glass-ghost px-3 py-1.5 text-xs flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <span className="text-xs text-muted-foreground ml-auto">
            {Math.max(0, currentStep + 1)} / {sortedLogs.length} steps
          </span>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-auto pr-2 space-y-0">
          {sortedLogs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No execution log entries for this mission.
            </div>
          ) : (
            sortedLogs.map((log, i) => {
              const isVisible = i <= currentStep;
              const isBlocked = log.status === "blocked";

              return (
                <div
                  key={log.id}
                  className={`flex items-start gap-3 py-3 transition-all duration-300 ${
                    isVisible ? "opacity-100" : "opacity-20"
                  } ${i < sortedLogs.length - 1 ? "border-b border-border" : ""}`}
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center pt-0.5">
                    {isBlocked ? (
                      <XCircle className={`h-4 w-4 shrink-0 ${isVisible ? "text-destructive" : "text-muted"}`} />
                    ) : (
                      <CheckCircle className={`h-4 w-4 shrink-0 ${isVisible ? "text-primary" : "text-muted"}`} />
                    )}
                    {i < sortedLogs.length - 1 && (
                      <div className={`w-px h-full min-h-[16px] mt-1 ${isVisible ? (isBlocked ? "bg-destructive/30" : "bg-primary/30") : "bg-muted"}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">{log.action}</span>
                      <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                        isBlocked ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {format(new Date(log.timestamp), "HH:mm:ss")}
                    </p>
                    {isBlocked && log.block_reason && (
                      <p className="text-xs text-destructive mt-1">
                        {log.block_type && <span className="font-semibold">[{log.block_type}]</span>} {log.block_reason}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
