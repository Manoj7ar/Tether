import { useUserSettings } from "@/hooks/useUserSettings";
import { Zap } from "lucide-react";

export default function AmbientBudgetCard() {
  const { data: settings } = useUserSettings();

  if (!settings?.ambient_enabled) return null;

  const used = settings.ambient_budget_used;
  const max = settings.ambient_budget_max;
  const percent = max > 0 ? (used / max) * 100 : 0;
  const ringPercent = (percent / 100) * 283;

  const color =
    percent < 60 ? "hsl(var(--primary))" :
    percent < 85 ? "hsl(var(--accent))" :
    "hsl(var(--destructive))";

  // Check if window needs reset
  const windowStart = new Date(settings.ambient_budget_window_start);
  const windowAge = Date.now() - windowStart.getTime();
  const hoursRemaining = Math.max(0, 24 - windowAge / (60 * 60 * 1000));

  return (
    <div className="card-tether p-5 animate-card-in">
      <div className="flex items-start gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
            <circle
              cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="6"
              strokeDasharray={`${ringPercent} 283`} strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Ambient Budget
            <span className="text-[10px] font-mono text-muted-foreground">
              {used}/{max}
            </span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hoursRemaining > 0
              ? `Resets in ${Math.ceil(hoursRemaining)}h`
              : "Ready to reset"}
          </p>
          <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${percent}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
