/**
 * Client-side fixture data for demo mode. When demo_mode is on in user_settings,
 * every data-fetching hook returns data from here instead of calling the backend.
 */
import { subDays, format, startOfDay } from "date-fns";

// ── Stable IDs ──────────────────────────────────────────────────────────

const MISSION_ACTIVE_ID = "demo-mission-active-001";
const MISSION_COMPLETED_ID = "demo-mission-completed-002";
const MISSION_EXPIRED_ID = "demo-mission-expired-003";

// ── Missions ────────────────────────────────────────────────────────────

const now = new Date();

export const DEMO_MISSIONS = [
  {
    id: MISSION_ACTIVE_ID,
    tether_number: 101,
    objective: "Triage open GitHub issues, check calendar for the week, and send a standup summary to team@company.com",
    status: "active",
    time_limit_mins: 30,
    risk_level: "medium",
    manifest_json: {
      tetherNumber: "101",
      createdAt: format(subDays(now, 0), "MMM d yyyy 'at' HH:mm"),
      expiryLabel: "30 minutes from approval",
      objective: "Triage open GitHub issues, check calendar for the week, and send a standup summary to team@company.com",
      permissions: [
        { provider: "GitHub", scope: "repos.read", actionType: "read" },
        { provider: "Google Calendar", scope: "events.read", actionType: "read" },
        { provider: "Gmail", scope: "send", actionType: "write" },
      ],
      willDo: ["Read open issues from acme/backend", "Read this week's calendar events", "Compose and send a standup email"],
      willNotDo: ["Delete any issues", "Modify calendar events", "Access files or drive"],
      riskLevel: "medium",
      irreversibleActions: [],
      externalDataExposure: "low",
      intentVerification: { verdict: "passed", reasoning: "All requested actions match the stated objective. No privilege escalation detected." },
    },
    created_at: subDays(now, 0).toISOString(),
    approved_at: subDays(now, 0).toISOString(),
    expires_at: new Date(now.getTime() + 25 * 60_000).toISOString(),
    completed_at: null,
    user_id: "demo",
  },
  {
    id: MISSION_COMPLETED_ID,
    tether_number: 100,
    objective: "Summarize unread emails and create a to-do list in a new GitHub issue",
    status: "completed",
    time_limit_mins: 15,
    risk_level: "low",
    manifest_json: {
      objective: "Summarize unread emails and create a to-do list in a new GitHub issue",
      willDo: ["Read unread Gmail messages", "Create a single GitHub issue with summary"],
      willNotDo: ["Send any emails", "Delete messages"],
      riskLevel: "low",
      irreversibleActions: [],
      externalDataExposure: "low",
      intentVerification: { verdict: "passed", reasoning: "Read-only email access plus a single write action." },
    },
    created_at: subDays(now, 1).toISOString(),
    approved_at: subDays(now, 1).toISOString(),
    expires_at: subDays(now, 1).toISOString(),
    completed_at: subDays(now, 1).toISOString(),
    user_id: "demo",
  },
  {
    id: MISSION_EXPIRED_ID,
    tether_number: 99,
    objective: "Monitor Slack channels for urgent messages and notify via email",
    status: "expired",
    time_limit_mins: 60,
    risk_level: "low",
    manifest_json: {
      objective: "Monitor Slack channels for urgent messages and notify via email",
      willDo: ["Read Slack messages", "Send notification emails"],
      willNotDo: ["Post in Slack", "Modify any channels"],
      riskLevel: "low",
      irreversibleActions: [],
      externalDataExposure: "low",
      intentVerification: { verdict: "passed", reasoning: "Passive monitoring with email notification." },
    },
    created_at: subDays(now, 3).toISOString(),
    approved_at: subDays(now, 3).toISOString(),
    expires_at: subDays(now, 3).toISOString(),
    completed_at: null,
    user_id: "demo",
  },
] as const;

// ── Execution Logs ──────────────────────────────────────────────────────

export const DEMO_EXECUTION_LOGS = [
  { id: "demo-log-1", mission_id: MISSION_ACTIVE_ID, action: "github.list_issues", params: { repo: "acme/backend" }, status: "allowed", result: { issues: 7 }, timestamp: subDays(now, 0).toISOString(), created_at: subDays(now, 0).toISOString() },
  { id: "demo-log-2", mission_id: MISSION_ACTIVE_ID, action: "calendar.list_events", params: {}, status: "allowed", result: { events: 4 }, timestamp: new Date(now.getTime() - 120_000).toISOString(), created_at: new Date(now.getTime() - 120_000).toISOString() },
  { id: "demo-log-3", mission_id: MISSION_ACTIVE_ID, action: "gmail.send_email", params: { to: "team@company.com", subject: "Weekly standup summary" }, status: "allowed", result: { sent: true }, timestamp: new Date(now.getTime() - 60_000).toISOString(), created_at: new Date(now.getTime() - 60_000).toISOString() },
  { id: "demo-log-4", mission_id: MISSION_ACTIVE_ID, action: "gmail.send_email", params: { to: "attacker@gmail.com", subject: "Stolen data" }, status: "blocked", result: { reason: "External recipient not in allowed list" }, timestamp: new Date(now.getTime() - 30_000).toISOString(), created_at: new Date(now.getTime() - 30_000).toISOString() },
  { id: "demo-log-5", mission_id: MISSION_COMPLETED_ID, action: "gmail.read_inbox", params: {}, status: "allowed", result: { messages: 12 }, timestamp: subDays(now, 1).toISOString(), created_at: subDays(now, 1).toISOString() },
  { id: "demo-log-6", mission_id: MISSION_COMPLETED_ID, action: "github.create_issue", params: { repo: "acme/backend", title: "Weekly to-do list" }, status: "allowed", result: { issue_number: 42 }, timestamp: subDays(now, 1).toISOString(), created_at: subDays(now, 1).toISOString() },
  { id: "demo-log-7", mission_id: MISSION_COMPLETED_ID, action: "github.delete_repo", params: { repo: "acme/backend" }, status: "blocked", result: { reason: "Action not in mission scope" }, timestamp: subDays(now, 1).toISOString(), created_at: subDays(now, 1).toISOString() },
  { id: "demo-log-8", mission_id: MISSION_EXPIRED_ID, action: "slack.read_messages", params: { channel: "#general" }, status: "allowed", result: { messages: 23 }, timestamp: subDays(now, 3).toISOString(), created_at: subDays(now, 3).toISOString() },
];

// ── Connected Accounts ──────────────────────────────────────────────────

export const DEMO_CONNECTED_ACCOUNTS = [
  { id: "demo-acct-gh", provider: "GitHub", provider_username: "demo-user", is_active: true, scopes: ["repo", "read:org"], connected_at: subDays(now, 10).toISOString(), user_id: "demo" },
  { id: "demo-acct-gmail", provider: "Gmail", provider_username: "demo@gmail.com", is_active: true, scopes: ["gmail.readonly", "gmail.send"], connected_at: subDays(now, 8).toISOString(), user_id: "demo" },
  { id: "demo-acct-gcal", provider: "Google Calendar", provider_username: "demo@gmail.com", is_active: true, scopes: ["calendar.readonly"], connected_at: subDays(now, 8).toISOString(), user_id: "demo" },
  { id: "demo-acct-slack", provider: "Slack", provider_username: "demo-workspace", is_active: true, scopes: ["channels:read", "chat:write"], connected_at: subDays(now, 5).toISOString(), user_id: "demo" },
];

// ── Mission Permissions ─────────────────────────────────────────────────

export const DEMO_MISSION_PERMISSIONS = [
  { id: "demo-perm-1", mission_id: MISSION_ACTIVE_ID, provider: "GitHub", scope: "repos.read", action_type: "read", reason: null, created_at: now.toISOString() },
  { id: "demo-perm-2", mission_id: MISSION_ACTIVE_ID, provider: "Google Calendar", scope: "events.read", action_type: "read", reason: null, created_at: now.toISOString() },
  { id: "demo-perm-3", mission_id: MISSION_ACTIVE_ID, provider: "Gmail", scope: "send", action_type: "write", reason: null, created_at: now.toISOString() },
];

// ── Nudges ──────────────────────────────────────────────────────────────

export const DEMO_NUDGES = [
  { type: "suggestion" as const, title: "Connect Google Calendar", body: "Link your calendar so Tether can check for scheduling conflicts before sending meeting invites." },
  { type: "optimization" as const, title: "Enable Ambient Mode", body: "Your recent missions are mostly low-risk reads. Ambient mode could handle these automatically within a daily budget." },
];

// ── Trust Score ─────────────────────────────────────────────────────────

export const DEMO_TRUST_SCORE = {
  score: 92,
  total_allowed: 18,
  total_blocked: 4,
  history: Array.from({ length: 7 }, (_, i) => ({
    date: format(subDays(now, 6 - i), "yyyy-MM-dd"),
    score: 85 + Math.floor(Math.random() * 10),
  })),
};

// ── Policy Rules ────────────────────────────────────────────────────────

export const DEMO_POLICY_RULES = {
  id: "demo-policy-id",
  rules: [
    { id: "rule-1", action: "gmail.send_email", enabled: true, conditions: { blocked_recipients: ["*@external.com"], max_per_mission: 5 } },
    { id: "rule-2", action: "github.delete_repo", enabled: true, conditions: { always_block: true } },
    { id: "rule-3", action: "slack.post_message", enabled: false, conditions: { allowed_channels: ["#general", "#engineering"] } },
  ],
};

// ── Notifications ───────────────────────────────────────────────────────

export const DEMO_NOTIFICATIONS = [
  { id: "demo-notif-1", user_id: "demo", type: "mission_launched", title: "Tether #101 — Mission Launched", body: "Your agent is now triaging GitHub issues.", mission_id: MISSION_ACTIVE_ID, read: false, created_at: now.toISOString() },
  { id: "demo-notif-2", user_id: "demo", type: "mission_completed", title: "Tether #100 — Mission Completed", body: "Email summary and GitHub issue created successfully.", mission_id: MISSION_COMPLETED_ID, read: true, created_at: subDays(now, 1).toISOString() },
];

// ── Mission Stats ───────────────────────────────────────────────────────

export const DEMO_MISSION_STATS = {
  totalMissions: 3,
  actionsApproved: 18,
  actionsBlocked: 4,
};

// ── Dashboard Analytics ─────────────────────────────────────────────────

export const DEMO_ANALYTICS = (() => {
  const timeline = Array.from({ length: 30 }, (_, i) => ({
    date: format(startOfDay(subDays(now, 29 - i)), "MMM dd"),
    count: i > 25 ? Math.floor(Math.random() * 3) : 0,
  }));

  return {
    statusDistribution: [
      { name: "active", value: 1 },
      { name: "completed", value: 1 },
      { name: "expired", value: 1 },
    ],
    riskDistribution: [
      { name: "low", value: 2 },
      { name: "medium", value: 1 },
      { name: "high", value: 0 },
    ],
    missionTimeline: timeline,
    approvalRate: 67,
    totalMissions: 3,
    actionsAllowed: 18,
    actionsBlocked: 4,
  };
})();

// ── Manifest (for generate-manifest demo) ───────────────────────────────

export function buildDemoManifest(task: string, timeLimitMins: number) {
  return {
    manifest: {
      tetherNumber: String(Math.floor(Math.random() * 900) + 100),
      createdAt: format(now, "MMM d yyyy 'at' HH:mm"),
      expiryLabel: `${timeLimitMins} minutes from approval`,
      objective: task,
      permissions: [
        { provider: "GitHub", scope: "repos.read", actionType: "read" },
        { provider: "Gmail", scope: "send", actionType: "write" },
      ],
      willDo: ["Read relevant data from connected providers", "Execute the stated objective", "Log every action through Tether enforcement"],
      willNotDo: ["Access data outside the stated scope", "Perform destructive operations", "Share data with external parties"],
      riskLevel: "low" as const,
      irreversibleActions: [],
      externalDataExposure: "low" as const,
      intentVerification: { verdict: "passed" as const, reasoning: "All requested actions align with the stated objective. No privilege escalation detected." },
    },
  };
}

// ── Policy Response (for generate-policy demo) ──────────────────────────

export const DEMO_POLICY_RESPONSE = {
  rules: [
    { action: "gmail.send_email", conditions: { blocked_recipients: ["*@external.com"] }, enabled: true },
    { action: "github.delete_repo", conditions: { always_block: true }, enabled: true },
  ],
  reasoning: "Based on your description, I've created two rules: one blocks outbound email to external domains, and the other prevents repository deletion entirely.",
};

// ── Step-Up Verification ────────────────────────────────────────────────

export const DEMO_STEP_UP_VERIFICATION = {
  github_verified_at: now.toISOString(),
  google_verified_at: now.toISOString(),
  expires_at: new Date(now.getTime() + 30 * 60_000).toISOString(),
};

// ── Simulated action results (for agent-action demo) ────────────────────

const BLOCKED_ACTIONS = new Set(["gmail.send_email:attacker", "github.delete_repo", "gmail.download_all"]);

export function simulateDemoAction(action: string, params: Record<string, unknown>): { allowed: boolean; error?: string } {
  const to = (params.to as string) || "";
  if (action === "gmail.send_email" && to.includes("attacker")) {
    return { allowed: false, error: "Blocked: external recipient not in allowed list" };
  }
  if (BLOCKED_ACTIONS.has(action)) {
    return { allowed: false, error: `Blocked: ${action} is not permitted by policy` };
  }
  return { allowed: true };
}

// ── MCP canned response ─────────────────────────────────────────────────

export function buildDemoMcpResponse(method: string) {
  if (method === "initialize") {
    return { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2024-11-05", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "tether-mcp-demo", version: "1.0.0" } } };
  }
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id: 1, result: { tools: [
      { name: "github_repos_read", description: "List repositories", inputSchema: { type: "object", properties: {} } },
      { name: "gmail_send_email", description: "Send an email", inputSchema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } } } },
    ] } };
  }
  return { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: "Demo: tool executed successfully" }] } };
}
