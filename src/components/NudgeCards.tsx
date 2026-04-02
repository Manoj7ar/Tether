import { useNudges, useDismissNudge, type Nudge } from "@/hooks/useNudges";
import { Lightbulb, AlertTriangle, Zap, X } from "lucide-react";

const nudgeIcons = {
  suggestion: Lightbulb,
  warning: AlertTriangle,
  optimization: Zap,
};

const nudgeStyles = {
  suggestion: "border-primary/20 bg-primary/5",
  warning: "border-accent/20 bg-accent/5",
  optimization: "border-secondary/20 bg-secondary/5",
};

const nudgeIconColor = {
  suggestion: "text-primary",
  warning: "text-accent",
  optimization: "text-secondary",
};

export default function NudgeCards() {
  const { data, isLoading } = useNudges();
  const dismissMutation = useDismissNudge();

  if (isLoading || !data) return null;

  const visibleNudges = data.nudges.filter(
    (n) => !data.dismissedIds.includes(n.title)
  );

  if (visibleNudges.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleNudges.map((nudge, i) => {
        const Icon = nudgeIcons[nudge.type] || Lightbulb;
        return (
          <div
            key={i}
            className={`rounded-xl border px-4 py-3 flex items-start gap-3 animate-card-in ${nudgeStyles[nudge.type] || ""}`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${nudgeIconColor[nudge.type] || ""}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">{nudge.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{nudge.body}</p>
            </div>
            <button
              onClick={() => dismissMutation.mutate(nudge.title)}
              className="text-muted-foreground hover:text-foreground p-0.5 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
