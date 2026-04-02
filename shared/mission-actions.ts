export type ProviderName = "GitHub" | "Gmail" | "Google Calendar" | "Slack";
export type ProviderSlug = "github" | "gmail" | "calendar" | "slack";
export type ActionType = "read" | "write";
export type RiskLevel = "low" | "medium" | "high";

export interface MissionActionDefinition {
  id: string;
  provider: ProviderName;
  providerSlug: ProviderSlug;
  title: string;
  description: string;
  actionType: ActionType;
  riskLevel: RiskLevel;
  requiredScopes: string[];
  requiredParams: string[];
  paramsSchema: Record<string, "string" | "number" | "boolean" | "object" | "string[]">;
}

export interface ResolvedMissionAction {
  definition: MissionActionDefinition;
  params: Record<string, unknown>;
}

export const missionActionRegistry: MissionActionDefinition[] = [
  {
    id: "github.list_issues",
    provider: "GitHub",
    providerSlug: "github",
    title: "List GitHub Issues",
    description: "Read issues for a repository.",
    actionType: "read",
    riskLevel: "low",
    requiredScopes: ["issues:read", "repo:read", "repo"],
    requiredParams: ["repo"],
    paramsSchema: { repo: "string", state: "string" },
  },
  {
    id: "github.create_issue",
    provider: "GitHub",
    providerSlug: "github",
    title: "Create GitHub Issue",
    description: "Create a new issue in a repository.",
    actionType: "write",
    riskLevel: "medium",
    requiredScopes: ["issues:write", "repo"],
    requiredParams: ["repo", "title", "body"],
    paramsSchema: { repo: "string", title: "string", body: "string" },
  },
  {
    id: "github.comment_issue",
    provider: "GitHub",
    providerSlug: "github",
    title: "Comment on GitHub Issue",
    description: "Add a comment to an issue.",
    actionType: "write",
    riskLevel: "medium",
    requiredScopes: ["issues:write", "repo"],
    requiredParams: ["repo", "issue_number", "body"],
    paramsSchema: { repo: "string", issue_number: "number", body: "string" },
  },
  {
    id: "github.delete_repo",
    provider: "GitHub",
    providerSlug: "github",
    title: "Delete GitHub Repository",
    description: "Delete a repository.",
    actionType: "write",
    riskLevel: "high",
    requiredScopes: ["repo:admin", "delete_repo"],
    requiredParams: ["repo"],
    paramsSchema: { repo: "string" },
  },
  {
    id: "gmail.list_messages",
    provider: "Gmail",
    providerSlug: "gmail",
    title: "List Gmail Messages",
    description: "List Gmail messages matching a query.",
    actionType: "read",
    riskLevel: "low",
    requiredScopes: ["gmail.read", "gmail.readonly"],
    requiredParams: [],
    paramsSchema: { query: "string", max_results: "number" },
  },
  {
    id: "gmail.read_message",
    provider: "Gmail",
    providerSlug: "gmail",
    title: "Read Gmail Message",
    description: "Read a single Gmail message.",
    actionType: "read",
    riskLevel: "low",
    requiredScopes: ["gmail.read", "gmail.readonly"],
    requiredParams: ["message_id"],
    paramsSchema: { message_id: "string" },
  },
  {
    id: "gmail.send_email",
    provider: "Gmail",
    providerSlug: "gmail",
    title: "Send Gmail Message",
    description: "Send an email through Gmail.",
    actionType: "write",
    riskLevel: "medium",
    requiredScopes: ["gmail.send", "gmail.compose"],
    requiredParams: ["to", "subject", "body"],
    paramsSchema: { to: "string", subject: "string", body: "string" },
  },
  {
    id: "gmail.download_all",
    provider: "Gmail",
    providerSlug: "gmail",
    title: "Export Gmail Mailbox",
    description: "Read large amounts of Gmail data.",
    actionType: "read",
    riskLevel: "high",
    requiredScopes: ["gmail.export", "gmail.read"],
    requiredParams: [],
    paramsSchema: {},
  },
  {
    id: "calendar.list_events",
    provider: "Google Calendar",
    providerSlug: "calendar",
    title: "List Calendar Events",
    description: "Read calendar events.",
    actionType: "read",
    riskLevel: "low",
    requiredScopes: ["events:read", "calendar.read", "calendar.events.read"],
    requiredParams: [],
    paramsSchema: { calendar_id: "string", time_min: "string", time_max: "string" },
  },
  {
    id: "calendar.create_event",
    provider: "Google Calendar",
    providerSlug: "calendar",
    title: "Create Calendar Event",
    description: "Create a new calendar event.",
    actionType: "write",
    riskLevel: "medium",
    requiredScopes: ["events:write", "calendar.write", "calendar.events"],
    requiredParams: ["summary", "start", "end"],
    paramsSchema: {
      calendar_id: "string",
      summary: "string",
      description: "string",
      start: "string",
      end: "string",
    },
  },
  {
    id: "calendar.update_event",
    provider: "Google Calendar",
    providerSlug: "calendar",
    title: "Update Calendar Event",
    description: "Update an existing calendar event.",
    actionType: "write",
    riskLevel: "medium",
    requiredScopes: ["events:write", "calendar.write", "calendar.events"],
    requiredParams: ["event_id"],
    paramsSchema: {
      calendar_id: "string",
      event_id: "string",
      summary: "string",
      description: "string",
      start: "string",
      end: "string",
    },
  },
  {
    id: "slack.list_channels",
    provider: "Slack",
    providerSlug: "slack",
    title: "List Slack Channels",
    description: "Read the connected Slack workspace channels.",
    actionType: "read",
    riskLevel: "low",
    requiredScopes: ["channels:read", "conversations:read"],
    requiredParams: [],
    paramsSchema: {},
  },
  {
    id: "slack.read_history",
    provider: "Slack",
    providerSlug: "slack",
    title: "Read Slack Channel History",
    description: "Read a channel's recent messages.",
    actionType: "read",
    riskLevel: "medium",
    requiredScopes: ["channels:history", "groups:history"],
    requiredParams: ["channel"],
    paramsSchema: { channel: "string", limit: "number" },
  },
  {
    id: "slack.post_message",
    provider: "Slack",
    providerSlug: "slack",
    title: "Post Slack Message",
    description: "Post a message to a Slack channel.",
    actionType: "write",
    riskLevel: "medium",
    requiredScopes: ["chat:write"],
    requiredParams: ["channel", "text"],
    paramsSchema: { channel: "string", text: "string" },
  },
];

const aliasMap: Record<string, string> = {
  "github.list_issues": "github.list_issues",
  "github.comment_issue": "github.comment_issue",
  "github.create_issue_comment": "github.comment_issue",
  "github.create_issue": "github.create_issue",
  "github.delete_repo": "github.delete_repo",
  "gmail.list_messages": "gmail.list_messages",
  "gmail.read_message": "gmail.read_message",
  "gmail.send_email": "gmail.send_email",
  "gmail.download_all": "gmail.download_all",
  "calendar.list_events": "calendar.list_events",
  "calendar.create_event": "calendar.create_event",
  "calendar.update_event": "calendar.update_event",
  "slack.list_channels": "slack.list_channels",
  "slack.read_history": "slack.read_history",
  "slack.post_message": "slack.post_message",
};

export function normalizeActionId(action: string): string {
  return aliasMap[action] ?? action;
}

const scopeCanonicalMap: Record<string, string> = {
  issues_read: "github_issues_read",
  repo_read: "github_repo_read",
  repo: "github_repo_write",
  public_repo: "github_repo_write",
  issues_write: "github_issues_write",
  repo_admin: "github_repo_admin",
  delete_repo: "github_repo_delete",

  gmail_read: "gmail_read",
  gmail_readonly: "gmail_read",
  gmail_modify: "gmail_read",
  gmail_send: "gmail_send",
  gmail_compose: "gmail_send",
  gmail_export: "gmail_export",
  https_www_googleapis_com_auth_gmail_readonly: "gmail_read",
  https_www_googleapis_com_auth_gmail_modify: "gmail_read",
  https_www_googleapis_com_auth_gmail_send: "gmail_send",
  https_www_googleapis_com_auth_gmail_compose: "gmail_send",

  events_read: "calendar_events_read",
  calendar_read: "calendar_events_read",
  calendar_events_read: "calendar_events_read",
  calendar_events_readonly: "calendar_events_read",
  events_write: "calendar_events_write",
  calendar_write: "calendar_events_write",
  calendar_events: "calendar_events_write",
  calendar: "calendar_events_write",
  https_www_googleapis_com_auth_calendar_readonly: "calendar_events_read",
  https_www_googleapis_com_auth_calendar_events_readonly: "calendar_events_read",
  https_www_googleapis_com_auth_calendar_events: "calendar_events_write",
  https_www_googleapis_com_auth_calendar: "calendar_events_write",

  channels_read: "slack_channels_read",
  conversations_read: "slack_channels_read",
  channels_history: "slack_history_read",
  groups_history: "slack_history_read",
  conversations_history: "slack_history_read",
  chat_write: "slack_chat_write",
};

export function getMissionAction(action: string): MissionActionDefinition | undefined {
  const normalized = normalizeActionId(action);
  return missionActionRegistry.find((entry) => entry.id === normalized);
}

export function normalizeScope(scope: string): string {
  const normalized = scope.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return scopeCanonicalMap[normalized] ?? normalized;
}

export function hasRequiredScope(
  action: MissionActionDefinition,
  grantedScopes: string[],
): boolean {
  const normalizedGranted = grantedScopes.map(normalizeScope);
  const grantedScopeSet = new Set(normalizedGranted);

  return action.requiredScopes.some((required) => {
    const normalizedRequired = normalizeScope(required);
    if (grantedScopeSet.has(normalizedRequired)) {
      return true;
    }

    if (normalizedRequired === "github_issues_read") {
      return grantedScopeSet.has("github_repo_read") || grantedScopeSet.has("github_repo_write");
    }

    if (normalizedRequired === "github_issues_write") {
      return grantedScopeSet.has("github_repo_write") || grantedScopeSet.has("github_repo_admin");
    }

    if (normalizedRequired === "github_repo_read") {
      return grantedScopeSet.has("github_repo_write") || grantedScopeSet.has("github_repo_admin");
    }

    if (normalizedRequired === "github_repo_delete") {
      return grantedScopeSet.has("github_repo_admin");
    }

    return false;
  });
}

export function validateActionParams(
  action: MissionActionDefinition,
  rawParams: Record<string, unknown> | null | undefined,
): { valid: true; params: Record<string, unknown> } | { valid: false; error: string } {
  const params = rawParams ?? {};

  for (const key of action.requiredParams) {
    const value = params[key];
    if (value === undefined || value === null || (typeof value === "string" && value.trim().length === 0)) {
      return { valid: false, error: `Parameter "${key}" is required` };
    }
  }

  for (const [key, valueType] of Object.entries(action.paramsSchema)) {
    const value = params[key];
    if (value === undefined || value === null) {
      continue;
    }

    switch (valueType) {
      case "string":
        if (typeof value !== "string") return { valid: false, error: `Parameter "${key}" must be a string` };
        break;
      case "number":
        if (typeof value !== "number") return { valid: false, error: `Parameter "${key}" must be a number` };
        break;
      case "boolean":
        if (typeof value !== "boolean") return { valid: false, error: `Parameter "${key}" must be a boolean` };
        break;
      case "object":
        if (typeof value !== "object" || Array.isArray(value)) {
          return { valid: false, error: `Parameter "${key}" must be an object` };
        }
        break;
      case "string[]":
        if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
          return { valid: false, error: `Parameter "${key}" must be a string array` };
        }
        break;
    }
  }

  return { valid: true, params };
}

export function getProviderSlug(provider: string): ProviderSlug | null {
  const normalized = provider.toLowerCase().replace(/\s+/g, "");
  if (normalized === "github") return "github";
  if (normalized === "gmail") return "gmail";
  if (normalized === "googlecalendar" || normalized === "calendar") return "calendar";
  if (normalized === "slack") return "slack";
  return null;
}

/** Actions that require a recent Auth0 re-authentication (step-up) before execution or mission approval. */
export const STEP_UP_REQUIRED_ACTION_IDS = new Set<string>([
  "github.delete_repo",
  "gmail.download_all",
]);

const STEP_UP_WINDOW_MS = 10 * 60 * 1000;

export function actionRequiresStepUp(actionId: string): boolean {
  return STEP_UP_REQUIRED_ACTION_IDS.has(normalizeActionId(actionId));
}

export function missionRequiresStepUpApproval(missionActionIds: string[]): boolean {
  return missionActionIds.some((id) => actionRequiresStepUp(id));
}

/** Action IDs the mission's granted permissions can satisfy (same logic as MCP tool exposure). */
export function getCapableActionIdsFromPermissions(
  permissions: Array<{ provider: string; scope: string }>,
): string[] {
  const ids = new Set<string>();
  const byMissionProvider = permissions;

  for (const definition of missionActionRegistry) {
    const sameProvider = byMissionProvider.some((p) => p.provider === definition.provider);
    if (!sameProvider) continue;

    const grantedScopes = byMissionProvider
      .filter((p) => p.provider === definition.provider)
      .map((p) => p.scope);

    if (hasRequiredScope(definition, grantedScopes)) {
      ids.add(definition.id);
    }
  }

  return Array.from(ids);
}

export function stepUpVerificationTtlIso(nowMs: number = Date.now()): string {
  return new Date(nowMs + STEP_UP_WINDOW_MS).toISOString();
}
