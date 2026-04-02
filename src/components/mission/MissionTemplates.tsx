import { GitPullRequest, Mail, Calendar, Eye, Activity } from "lucide-react";

export interface MissionTemplate {
  id: string;
  icon: typeof GitPullRequest;
  title: string;
  description: string;
  objective: string;
  timeLimit: number;
}

export const missionTemplates: MissionTemplate[] = [
  {
    id: "triage-issues",
    icon: GitPullRequest,
    title: "Triage GitHub Issues",
    description: "Label, prioritize, and assign open issues",
    objective: "Triage all open GitHub issues: add priority labels, assign to appropriate team members, and close any duplicates or stale issues.",
    timeLimit: 30,
  },
  {
    id: "weekly-report",
    icon: Mail,
    title: "Send Weekly Report",
    description: "Compile activity and email a summary",
    objective: "Compile this week's completed tasks, key metrics, and blockers into a summary email and send it to the team distribution list.",
    timeLimit: 15,
  },
  {
    id: "sync-calendar",
    icon: Calendar,
    title: "Sync Calendar Events",
    description: "Cross-check and update calendar entries",
    objective: "Sync calendar events across Google Calendar and Outlook, resolve conflicts, and send updated invites for any changed meetings.",
    timeLimit: 30,
  },
  {
    id: "review-prs",
    icon: Eye,
    title: "Review Pull Requests",
    description: "Review open PRs and leave feedback",
    objective: "Review all open pull requests in the repository: check for code quality issues, suggest improvements, and approve or request changes.",
    timeLimit: 60,
  },
  {
    id: "monitor-deploys",
    icon: Activity,
    title: "Monitor Deployments",
    description: "Check deployment status and health",
    objective: "Monitor active deployments, verify health checks pass, check error rates, and alert if any service is degraded.",
    timeLimit: 15,
  },
];

interface MissionTemplatesProps {
  onSelect: (template: MissionTemplate) => void;
  compact?: boolean;
}

export default function MissionTemplates({ onSelect, compact = false }: MissionTemplatesProps) {
  const items = compact ? missionTemplates.slice(0, 3) : missionTemplates;

  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className="card-tether p-4 text-left hover:shadow-md transition-all group flex items-start gap-3"
        >
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <t.icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{t.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
            {!compact && (
              <span className="text-xs text-primary mt-1 inline-block">
                {t.timeLimit === 60 ? "1 hour" : `${t.timeLimit} min`}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
