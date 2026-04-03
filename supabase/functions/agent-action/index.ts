import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  actionRequiresStepUp,
  getMissionAction,
  getProviderSlug,
  hasRequiredScope,
  normalizeActionId,
  validateActionParams,
} from "../../../shared/mission-actions.ts";
import { AuthError, requireAuth0User } from "../_shared/auth.ts";
import { demoExecutionPayload } from "../_shared/demo-fixtures.ts";
import { fetchDemoMode } from "../_shared/demo-mode.ts";
import { requireEnv } from "../_shared/env.ts";
import { ensureFreshProviderAccessToken } from "../_shared/oauth-token.ts";
import { executeProviderAction } from "../_shared/provider-execution.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function respond(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function updateTrustScore(supabaseUrl: string, userId: string) {
  try {
    const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    await fetch(`${supabaseUrl}/functions/v1/calculate-trust-score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: requireEnv("SUPABASE_ANON_KEY"),
      },
      body: JSON.stringify({ user_id: userId }),
    });
  } catch (error) {
    console.error("Trust score update failed:", error);
  }
}

type ServiceClient = ReturnType<typeof createClient>;

async function insertExecutionLog(
  supabase: ServiceClient,
  input: {
    mission_id: string;
    user_id: string;
    action: string;
    correlation_id?: string;
    latency_ms?: number | null;
    status: "allowed" | "blocked";
    params_json?: Record<string, unknown>;
    block_reason?: string | null;
    block_type?: string | null;
    result_json?: unknown;
    result_summary?: string | null;
  },
) {
  await supabase.from("execution_log").insert({
    mission_id: input.mission_id,
    user_id: input.user_id,
    action: input.action,
    correlation_id: input.correlation_id ?? null,
    latency_ms: input.latency_ms ?? null,
    status: input.status,
    params_json: input.params_json ?? {},
    block_reason: input.block_reason ?? null,
    block_type: input.block_type ?? null,
    result_json: input.result_json ?? null,
    result_summary: input.result_summary ?? null,
  });
}

async function assertStepUpSatisfied(
  supabase: ServiceClient,
  userId: string,
  missionId: string,
  definition: NonNullable<ReturnType<typeof getMissionAction>>,
  demoMode: boolean,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (demoMode) {
    return { ok: true };
  }

  if (!actionRequiresStepUp(definition.id)) {
    return { ok: true };
  }

  const { data: row, error } = await supabase
    .from("step_up_verifications")
    .select("github_verified_at, google_verified_at, expires_at")
    .eq("user_id", userId)
    .eq("mission_id", missionId)
    .maybeSingle();

  if (error) {
    console.error("step_up_verifications lookup failed:", error);
    return { ok: false, reason: "Step-up verification unavailable" };
  }

  const now = Date.now();
  if (!row?.expires_at || new Date(row.expires_at).getTime() <= now) {
    return {
      ok: false,
      reason: "Step-up required: re-authenticate with the provider for this mission (Settings → high-risk verification)",
    };
  }

  if (definition.provider === "GitHub" && !row.github_verified_at) {
    return { ok: false, reason: "Step-up required: re-authenticate with GitHub for this mission" };
  }
  if (definition.provider === "Gmail" && !row.google_verified_at) {
    return { ok: false, reason: "Step-up required: re-authenticate with Google for this mission" };
  }

  return { ok: true };
}

async function executeAuthorizedAction(
  supabase: ServiceClient,
  userId: string,
  missionId: string,
  actionId: string,
  params: Record<string, unknown>,
  permissionRows: Array<{ provider: string; scope: string }>,
  demoMode: boolean,
) {
  const definition = getMissionAction(actionId);
  if (!definition) {
    throw new Error(`Unknown action: ${actionId}`);
  }

  const stepUp = await assertStepUpSatisfied(supabase, userId, missionId, definition, demoMode);
  if (!stepUp.ok) {
    return {
      ok: false as const,
      response: {
        error: stepUp.reason,
        blocked: true,
        block_type: "step_up_required",
      },
      status: 403,
      log: {
        latency_ms: 0,
        status: "blocked" as const,
        block_reason: stepUp.reason,
        block_type: "step_up_required",
      },
    };
  }

  const validation = validateActionParams(definition, params);
  if (!validation.valid) {
    return {
      ok: false as const,
      response: {
        error: validation.error,
        blocked: true,
        block_reason: validation.error,
      },
      status: 400,
      log: {
        latency_ms: 0,
        status: "blocked" as const,
        block_reason: validation.error,
        block_type: null,
      },
    };
  }

  const grantedScopes = permissionRows
    .filter((permission) => getProviderSlug(permission.provider) === definition.providerSlug)
    .map((permission) => permission.scope);

  if (!hasRequiredScope(definition, grantedScopes)) {
    return {
      ok: false as const,
      response: {
        error: "Action not in approved mission scope",
        blocked: true,
        block_type: "scope_violation",
      },
      status: 403,
      log: {
        latency_ms: 0,
        status: "blocked" as const,
        block_reason: "Action not in approved mission scope",
        block_type: "scope_violation",
      },
    };
  }

  if (demoMode) {
    const startedAt = Date.now();
    const { result, summary } = demoExecutionPayload(definition.id);
    const latencyMs = Math.max(1, Date.now() - startedAt);
    return {
      ok: true as const,
      response: {
        allowed: true,
        action: definition.id,
        result,
        summary,
      },
      status: 200,
      log: {
        latency_ms: latencyMs,
        status: "allowed" as const,
        result_json: result,
        result_summary: summary,
      },
    };
  }

  const { data: providerAccount } = await supabase
    .from("connected_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", definition.provider)
    .eq("is_active", true)
    .maybeSingle();

  if (!providerAccount) {
    return {
      ok: false as const,
      response: {
        error: `No active ${definition.provider} account is connected`,
        blocked: true,
        block_type: "policy_violation",
      },
      status: 403,
      log: {
        latency_ms: 0,
        status: "blocked" as const,
        block_reason: `No active ${definition.provider} account is connected`,
        block_type: "policy_violation",
      },
    };
  }

  const { data: providerSecrets } = await supabase
    .from("connected_account_secrets")
    .select("access_token_encrypted, refresh_token_encrypted, token_expires_at")
    .eq("account_id", providerAccount.id)
    .maybeSingle();

  if (!providerSecrets) {
    return {
      ok: false as const,
      response: {
        error: `${definition.provider} access token is unavailable`,
        blocked: true,
      },
      status: 500,
      log: {
        latency_ms: 0,
        status: "blocked" as const,
        block_reason: `${definition.provider} access token is unavailable`,
        block_type: null,
      },
    };
  }

  let accessToken: string;
  try {
    const fresh = await ensureFreshProviderAccessToken({
      access_token_encrypted: providerSecrets.access_token_encrypted,
      refresh_token_encrypted: providerSecrets.refresh_token_encrypted,
      token_expires_at: providerSecrets.token_expires_at,
    });
    accessToken = fresh.accessToken;
    if (fresh.persisted) {
      const updatePayload: Record<string, unknown> = {
        access_token_encrypted: fresh.persisted.access_token_encrypted,
        token_expires_at: fresh.persisted.token_expires_at,
        updated_at: new Date().toISOString(),
      };
      if (fresh.persisted.refresh_token_encrypted !== undefined) {
        updatePayload.refresh_token_encrypted = fresh.persisted.refresh_token_encrypted;
      }
      await supabase.from("connected_account_secrets").update(updatePayload).eq("account_id", providerAccount.id);
    }
  } catch {
    return {
      ok: false as const,
      response: {
        error: `${definition.provider} access token is unavailable`,
        blocked: true,
      },
      status: 500,
      log: {
        latency_ms: 0,
        status: "blocked" as const,
        block_reason: `${definition.provider} access token is unavailable`,
        block_type: null,
      },
    };
  }

  try {
    const startedAt = Date.now();
    const execution = await executeProviderAction(definition, validation.params, accessToken);
    const latencyMs = Date.now() - startedAt;
    return {
      ok: true as const,
      response: {
        allowed: true,
        action: definition.id,
        result: execution.result,
        summary: execution.resultSummary,
      },
      status: 200,
      log: {
        latency_ms: latencyMs,
        status: "allowed" as const,
        result_json: execution.result,
        result_summary: execution.resultSummary,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : `${definition.provider} execution failed`;
    return {
      ok: false as const,
      response: {
        error: message,
        blocked: true,
      },
      status: 502,
      log: {
        latency_ms: 0,
        status: "blocked" as const,
        block_reason: message,
        block_type: null,
      },
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const { userId } = await requireAuth0User(req);

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const demoMode = await fetchDemoMode(supabase, userId);

    const body = await req.json() as {
      mission_id?: string;
      action?: string;
      ambient?: boolean;
      params?: Record<string, unknown>;
    };
    const correlationId = crypto.randomUUID();
    const action = normalizeActionId(body.action ?? "");
    const params = body.params ?? {};

    if (!action) {
      return respond({ error: "action is required" }, 400);
    }

    const definition = getMissionAction(action);
    if (!definition) {
      return respond({ error: `Unknown action: ${action}` }, 400);
    }

    if (body.ambient === true) {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!settings?.ambient_enabled) {
        return respond({ error: "Ambient mode is not enabled" }, 403);
      }

      const allowedActions = Array.isArray(settings.ambient_allowed_actions)
        ? (settings.ambient_allowed_actions as string[]).map(normalizeActionId)
        : [];

      const now = new Date();
      const windowStart = settings.ambient_budget_window_start
        ? new Date(settings.ambient_budget_window_start)
        : now;

      if (now.getTime() - windowStart.getTime() > 24 * 60 * 60 * 1000) {
        await supabase.from("user_settings").update({
          ambient_budget_used: 0,
          ambient_budget_window_start: now.toISOString(),
        }).eq("user_id", userId);
        settings.ambient_budget_used = 0;
      }

      if (!allowedActions.includes(action)) {
        const { data: newMission, error } = await supabase.from("missions").insert({
          user_id: userId,
          objective: `Ambient agent requested: ${action}`,
          status: "pending",
          risk_level: definition.riskLevel,
          manifest_json: {
            objective: `Ambient agent requested: ${action}`,
            willDo: [definition.description],
            permissions: definition.requiredScopes.map((scope) => ({
              provider: definition.provider,
              scope,
              actionType: definition.actionType,
            })),
          },
        }).select().single();

        if (error) {
          return respond({ error: error.message }, 500);
        }

        const permissionRows = definition.requiredScopes.map((scope) => ({
          mission_id: newMission.id,
          provider: definition.provider,
          scope,
          action_type: definition.actionType,
        }));

        await supabase.from("mission_permissions").insert(permissionRows);
        return respond({ requires_approval: true, mission_id: newMission.id }, 202);
      }

      if (settings.ambient_budget_used >= settings.ambient_budget_max) {
        return respond({ error: "Ambient budget exhausted. Wait for reset or create a mission." }, 403);
      }

      let ambientMissionId = body.mission_id;
      if (!ambientMissionId) {
        const { data: existingAmbient } = await supabase.from("missions")
          .select("id")
          .eq("user_id", userId)
          .eq("objective", "Ambient Agent Session")
          .eq("status", "active")
          .maybeSingle();

        ambientMissionId = existingAmbient?.id;

        if (!ambientMissionId) {
          const { data: createdAmbient } = await supabase.from("missions").insert({
            user_id: userId,
            objective: "Ambient Agent Session",
            status: "active",
            risk_level: "low",
            approved_at: now.toISOString(),
          }).select().single();
          ambientMissionId = createdAmbient?.id;

          if (ambientMissionId) {
            await supabase.from("mission_permissions").insert(
              definition.requiredScopes.map((scope) => ({
                mission_id: ambientMissionId,
                provider: definition.provider,
                scope,
                action_type: definition.actionType,
              })),
            );
          }
        }
      }

      if (!ambientMissionId) {
        return respond({ error: "Unable to create ambient mission session" }, 500);
      }

      const execution = await executeAuthorizedAction(
        supabase,
        userId,
        ambientMissionId,
        action,
        params,
        definition.requiredScopes.map((scope) => ({ provider: definition.provider, scope })),
        demoMode,
      );

      await insertExecutionLog(supabase, {
        mission_id: ambientMissionId,
        user_id: userId,
        action,
        correlation_id: correlationId,
        params_json: params,
        ...execution.log,
      });

      if (execution.ok) {
        await supabase.from("user_settings").update({
          ambient_budget_used: settings.ambient_budget_used + 1,
        }).eq("user_id", userId);
      }

      updateTrustScore(supabaseUrl, userId);
      return respond({ correlation_id: correlationId, ...execution.response }, execution.status);
    }

    if (!body.mission_id) {
      return respond({ error: "mission_id is required" }, 400);
    }

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("*")
      .eq("id", body.mission_id)
      .eq("user_id", userId)
      .single();

    if (missionError || !mission) {
      return respond({ error: "Mission not found" }, 404);
    }

    const blockedStatusReasons: Record<string, string> = {
      pending: "Awaiting approval",
      rejected: "Mission rejected",
      completed: "Mission completed",
      expired: "Mission expired — access revoked",
    };

    const statusReason = blockedStatusReasons[mission.status];
    if (statusReason) {
      await insertExecutionLog(supabase, {
        mission_id: body.mission_id,
        user_id: userId,
        action,
        correlation_id: correlationId,
        status: "blocked",
        params_json: params,
        block_reason: statusReason,
        latency_ms: 0,
        block_type: mission.status === "expired" ? "scope_violation" : null,
      });
      updateTrustScore(supabaseUrl, userId);
      return respond({ correlation_id: correlationId, error: statusReason }, 403);
    }

    if (mission.expires_at && new Date(mission.expires_at) <= new Date()) {
      await supabase.from("missions").update({ status: "expired" }).eq("id", mission.id);
      await insertExecutionLog(supabase, {
        mission_id: body.mission_id,
        user_id: userId,
        action,
        correlation_id: correlationId,
        status: "blocked",
        params_json: params,
        block_reason: "Mission has expired",
        latency_ms: 0,
        block_type: "scope_violation",
      });
      updateTrustScore(supabaseUrl, userId);
      return respond({ correlation_id: correlationId, error: "Mission has expired" }, 403);
    }

    const { data: permissionRows } = await supabase
      .from("mission_permissions")
      .select("provider, scope")
      .eq("mission_id", body.mission_id);

    const { data: policyRows } = await supabase
      .from("policy_rules")
      .select("rules_json")
      .eq("user_id", userId)
      .limit(1);

    const rules = Array.isArray(policyRows?.[0]?.rules_json)
      ? policyRows[0].rules_json as Array<Record<string, unknown>>
      : [];

    for (const rule of rules) {
      if (rule.enabled === false) {
        continue;
      }

      const ruleAction = typeof rule.action === "string" ? normalizeActionId(rule.action) : "";
      const applies = ruleAction === action || ruleAction === "*" || ruleAction === `${definition.providerSlug}.*`;
      if (!applies) {
        continue;
      }

      const conditions = typeof rule.conditions === "object" && rule.conditions
        ? rule.conditions as Record<string, unknown>
        : {};

      if (conditions.allowed === false) {
        const reason = typeof conditions.reason === "string"
          ? conditions.reason
          : `Policy blocks ${action}`;
        await insertExecutionLog(supabase, {
          mission_id: body.mission_id,
          user_id: userId,
          action,
          correlation_id: correlationId,
          status: "blocked",
          params_json: params,
          block_reason: reason,
          latency_ms: 0,
          block_type: "policy_violation",
        });
        updateTrustScore(supabaseUrl, userId);
        return respond({ correlation_id: correlationId, error: reason, blocked: true, block_type: "policy_violation" }, 403);
      }

      if (conditions.block_external === true && action === "gmail.send_email") {
        const to = typeof params.to === "string" ? params.to : "";
        const allowedDomains = Array.isArray(conditions.allowed_domains)
          ? conditions.allowed_domains.filter((domain): domain is string => typeof domain === "string")
          : [];
        const emailDomain = to.split("@")[1] ?? "";

        if (allowedDomains.length > 0 && !allowedDomains.some((domain) => emailDomain.endsWith(domain))) {
          const reason = typeof conditions.reason === "string"
            ? conditions.reason
            : `Email to ${emailDomain} blocked by domain policy`;
          await insertExecutionLog(supabase, {
            mission_id: body.mission_id,
            user_id: userId,
            action,
            correlation_id: correlationId,
            status: "blocked",
            params_json: params,
            block_reason: reason,
            latency_ms: 0,
            block_type: "policy_violation",
          });
          updateTrustScore(supabaseUrl, userId);
          return respond({ correlation_id: correlationId, error: reason, blocked: true, block_type: "policy_violation" }, 403);
        }
      }
    }

    const execution = await executeAuthorizedAction(
      supabase,
      userId,
      body.mission_id,
      action,
      params,
      permissionRows ?? [],
      demoMode,
    );

    await insertExecutionLog(supabase, {
      mission_id: body.mission_id,
      user_id: userId,
      action,
      correlation_id: correlationId,
      params_json: params,
      ...execution.log,
    });

    updateTrustScore(supabaseUrl, userId);
    return respond({ correlation_id: correlationId, ...execution.response }, execution.status);
  } catch (error) {
    console.error("agent-action error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof AuthError ? error.status : 500;
    return respond({ error: message }, status);
  }
});
