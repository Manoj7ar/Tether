import type { Page, Route } from "@playwright/test";

type Mission = {
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  expires_at: string | null;
  id: string;
  intent_audit: Record<string, unknown> | null;
  manifest_json: Record<string, unknown> | null;
  objective: string;
  policy_check: Record<string, unknown> | null;
  risk_level: string | null;
  status: string;
  tether_number: number;
  time_limit_mins: number;
  updated_at: string;
  user_id: string;
};

type MissionPermission = {
  action_type: string;
  id: string;
  mission_id: string;
  provider: string;
  reason: string | null;
  scope: string;
};

type ConnectedAccount = {
  connected_at: string;
  id: string;
  is_active: boolean;
  provider: string;
  provider_username: string | null;
  scopes: string[];
  user_id: string;
};

type UserSettings = {
  ambient_allowed_actions: string[];
  ambient_budget_max: number;
  ambient_budget_used: number;
  ambient_budget_window_start: string | null;
  ambient_enabled: boolean;
  id: string;
  mcp_enabled: boolean;
  updated_at: string;
  user_id: string;
};

export type MockSupabaseState = {
  connectedAccounts: ConnectedAccount[];
  missionPermissions: MissionPermission[];
  missions: Mission[];
  userSettings: UserSettings;
};

const jsonHeaders = {
  "access-control-allow-origin": "*",
  "content-type": "application/json",
};

function nowIso() {
  return new Date("2026-03-28T12:00:00.000Z").toISOString();
}

function buildManifest(task: string) {
  return {
    tetherNumber: "—",
    createdAt: "Mar 28, 2026 at 12:00 UTC",
    expiryLabel: "30 minutes from approval",
    objective: task,
    permissions: [
      { provider: "GitHub", scope: "repo", actionType: "read" },
      { provider: "Gmail", scope: "https://www.googleapis.com/auth/gmail.send", actionType: "write" },
    ],
    willDo: [
      "Review the requested GitHub context.",
      "Draft and send a scoped internal summary email.",
    ],
    willNotDo: [
      "Delete repositories or mailboxes.",
      "Contact external recipients.",
    ],
    riskLevel: "medium",
    irreversibleActions: ["Send summary email"],
    externalDataExposure: "low",
    intentVerification: {
      verdict: "passed",
      reasoning: "Requested permissions are aligned with the mission objective.",
    },
  };
}

function createState(): MockSupabaseState {
  return {
    connectedAccounts: [],
    missionPermissions: [],
    missions: [],
    userSettings: {
      ambient_allowed_actions: [],
      ambient_budget_max: 50,
      ambient_budget_used: 0,
      ambient_budget_window_start: null,
      ambient_enabled: false,
      id: "settings-1",
      mcp_enabled: false,
      updated_at: nowIso(),
      user_id: "auth0|e2e-operator",
    },
  };
}

function isObjectRequest(route: Route) {
  return route.request().headers().accept?.includes("application/vnd.pgrst.object+json");
}

function filterRows<T extends Record<string, unknown>>(rows: T[], url: URL) {
  return rows.filter((row) => {
    return Array.from(url.searchParams.entries()).every(([key, value]) => {
      if (["select", "order", "limit", "offset"].includes(key)) {
        return true;
      }

      if (value.startsWith("eq.")) {
        return String(row[key]) === value.slice(3);
      }

      return true;
    });
  });
}

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify(data),
    headers: jsonHeaders,
    status,
  });
}

async function handleRest(route: Route, state: MockSupabaseState) {
  const request = route.request();
  const url = new URL(request.url());
  const table = url.pathname.split("/rest/v1/")[1];

  if (request.method() === "OPTIONS") {
    await fulfillJson(route, {});
    return;
  }

  if (table === "missions") {
    if (request.method() === "GET") {
      const filtered = filterRows(state.missions, url);
      await fulfillJson(route, isObjectRequest(route) ? filtered[0] ?? null : filtered);
      return;
    }

    if (request.method() === "POST") {
      const payload = JSON.parse(request.postData() || "{}") as Record<string, unknown>;
      const mission: Mission = {
        approved_at: null,
        completed_at: null,
        created_at: nowIso(),
        expires_at: null,
        id: "mission-1",
        intent_audit: (payload.intent_audit as Record<string, unknown>) || null,
        manifest_json: (payload.manifest_json as Record<string, unknown>) || null,
        objective: String(payload.objective || "Mission"),
        policy_check: null,
        risk_level: payload.risk_level ? String(payload.risk_level) : null,
        status: String(payload.status || "pending"),
        tether_number: 1,
        time_limit_mins: Number(payload.time_limit_mins || 30),
        updated_at: nowIso(),
        user_id: String(payload.user_id || "auth0|e2e-operator"),
      };
      state.missions = [mission];
      await fulfillJson(route, mission);
      return;
    }

    if (request.method() === "PATCH") {
      const payload = JSON.parse(request.postData() || "{}") as Record<string, unknown>;
      const id = url.searchParams.get("id")?.slice(3);
      const mission = state.missions.find((item) => item.id === id);
      if (!mission) {
        await fulfillJson(route, { error: "Mission not found" }, 404);
        return;
      }

      Object.assign(mission, payload, { updated_at: nowIso() });
      await fulfillJson(route, mission);
      return;
    }
  }

  if (table === "mission_permissions") {
    if (request.method() === "GET") {
      await fulfillJson(route, filterRows(state.missionPermissions, url));
      return;
    }

    if (request.method() === "POST") {
      const payload = JSON.parse(request.postData() || "[]") as Array<Record<string, unknown>>;
      const inserted = payload.map((item, index) => ({
        action_type: String(item.action_type),
        id: `perm-${index + 1}`,
        mission_id: String(item.mission_id),
        provider: String(item.provider),
        reason: item.reason ? String(item.reason) : null,
        scope: String(item.scope),
      }));
      state.missionPermissions = inserted;
      await fulfillJson(route, inserted);
      return;
    }
  }

  if (table === "connected_accounts") {
    if (request.method() === "GET") {
      await fulfillJson(route, state.connectedAccounts);
      return;
    }
  }

  if (table === "user_settings") {
    if (request.method() === "GET") {
      await fulfillJson(route, state.userSettings);
      return;
    }

    if (request.method() === "PATCH") {
      const payload = JSON.parse(request.postData() || "{}") as Record<string, unknown>;
      state.userSettings = {
        ...state.userSettings,
        ...payload,
        updated_at: nowIso(),
      };
      await fulfillJson(route, state.userSettings);
      return;
    }

    if (request.method() === "POST") {
      const payload = JSON.parse(request.postData() || "{}") as Record<string, unknown>;
      state.userSettings = {
        ...state.userSettings,
        ...payload,
        updated_at: nowIso(),
      };
      await fulfillJson(route, state.userSettings);
      return;
    }
  }

  if (["execution_log", "notifications"].includes(table)) {
    await fulfillJson(route, []);
    return;
  }

  if (["agent_trust_scores", "user_nudges"].includes(table)) {
    await fulfillJson(route, null);
    return;
  }

  await fulfillJson(route, []);
}

async function handleFunctions(route: Route, state: MockSupabaseState, baseUrl: string) {
  const request = route.request();
  const url = new URL(request.url());
  const action = url.searchParams.get("action");

  if (request.method() === "OPTIONS") {
    await fulfillJson(route, {});
    return;
  }

  if (url.pathname.endsWith("/generate-manifest")) {
    const payload = JSON.parse(request.postData() || "{}") as { task?: string };
    await fulfillJson(route, { manifest: buildManifest(payload.task || "Mission") });
    return;
  }

  if (url.pathname.endsWith("/auth0-token-vault") && action === "connect") {
    const payload = JSON.parse(request.postData() || "{}") as { provider?: string };
    const provider = payload.provider || "GitHub";
    state.connectedAccounts = [
      {
        connected_at: nowIso(),
        id: "account-1",
        is_active: true,
        provider,
        provider_username: "operator@tether.test",
        scopes: ["repo"],
        user_id: "auth0|e2e-operator",
      },
    ];
    await fulfillJson(route, { authorizeUrl: `${baseUrl}/accounts?connected=${encodeURIComponent(provider)}` });
    return;
  }

  if (url.pathname.endsWith("/auth0-token-vault") && action === "disconnect") {
    state.connectedAccounts = [];
    await fulfillJson(route, { success: true });
    return;
  }

  if (url.pathname.endsWith("/mission-approve")) {
    const payload = JSON.parse(request.postData() || "{}") as { mission_id?: string };
    const missionId = payload.mission_id;
    const mission = state.missions.find((m) => m.id === missionId);
    if (!mission) {
      await fulfillJson(route, { error: "Mission not found" }, 404);
      return;
    }
    const mins = mission.time_limit_mins ?? 30;
    const approvedAt = nowIso();
    Object.assign(mission, {
      status: "active",
      approved_at: approvedAt,
      expires_at: new Date(new Date(approvedAt).getTime() + mins * 60000).toISOString(),
      updated_at: nowIso(),
    });
    await fulfillJson(route, { mission });
    return;
  }

  if (url.pathname.endsWith("/agent-action")) {
    await fulfillJson(route, { allowed: true, result: "ok" });
    return;
  }

  if (url.pathname.endsWith("/generate-policy")) {
    await fulfillJson(route, {
      explanation: "Mocked policy generation",
      rules: [{ action: "gmail.send_email", enabled: true, conditions: { block_external: true } }],
    });
    return;
  }

  if (url.pathname.endsWith("/generate-nudges")) {
    await fulfillJson(route, { cached: false, nudges: [] });
    return;
  }

  await fulfillJson(route, {});
}

export async function installSupabaseMocks(page: Page) {
  const state = createState();
  const baseUrl = "http://127.0.0.1:4173";

  await page.route("https://mock-project.supabase.co/rest/v1/**", async (route) => {
    await handleRest(route, state);
  });

  await page.route("https://mock-project.supabase.co/functions/v1/**", async (route) => {
    await handleFunctions(route, state, baseUrl);
  });

  return state;
}
