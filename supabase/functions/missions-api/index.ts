/**
 * Missions CRUD Edge Function.
 *
 * Handles all mission-related database operations server-side using the
 * service role key, so Auth0 opaque tokens (no audience) work correctly.
 * The client sends the Auth0 token; we validate it via requireAuth0User
 * and scope all queries to that user's ID.
 *
 * Routes (via JSON body `action` field):
 *   POST { action: "list", statusFilter? }         → list missions
 *   POST { action: "get", id }                     → single mission
 *   POST { action: "create", mission, permissions? }→ insert mission + permissions
 *   POST { action: "update", id, updates }         → update mission fields
 *   POST { action: "list_permissions", mission_id } → list permissions for a mission
 *   POST { action: "list_execution_log", mission_id?, limit? } → execution log
 *   POST { action: "insert_execution_log", entry }  → insert log entry
 *   POST { action: "list_connected_accounts" }      → connected accounts
 *   POST { action: "mission_stats" }                → aggregated stats
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AuthError, requireAuth0User } from "../_shared/auth.ts";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireAuth0User(req);
    const db = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const rawText = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawText);
    } catch {
      console.error("missions-api: failed to parse body:", rawText.slice(0, 200));
      return json({ error: "Invalid request body" }, 400);
    }
    const action: string = body.action as string;
    console.log("missions-api:", action, "userId:", userId);

    switch (action) {
      // ── List missions ───────────────────────────────────────────────
      case "list": {
        let q = db
          .from("missions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (body.statusFilter && body.statusFilter !== "all") {
          q = q.eq("status", body.statusFilter);
        }
        const { data, error } = await q;
        if (error) throw error;
        return json({ data });
      }

      // ── List active/pending missions ────────────────────────────────
      case "list_active": {
        const { data, error } = await db
          .from("missions")
          .select("*")
          .eq("user_id", userId)
          .in("status", ["active", "pending"])
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ data });
      }

      // ── Get single mission ──────────────────────────────────────────
      case "get": {
        const { data, error } = await db
          .from("missions")
          .select("*")
          .eq("id", body.id)
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        return json({ data });
      }

      // ── Create mission + permissions ────────────────────────────────
      case "create": {
        const m = body.mission;
        const { data: mission, error } = await db
          .from("missions")
          .insert({
            objective: m.objective,
            time_limit_mins: m.time_limit_mins,
            manifest_json: m.manifest_json ?? null,
            risk_level: m.risk_level ?? null,
            intent_audit: m.intent_audit ?? null,
            user_id: userId,
            status: "pending",
          })
          .select()
          .single();
        if (error) throw error;

        if (Array.isArray(body.permissions) && body.permissions.length > 0) {
          const { error: permErr } = await db
            .from("mission_permissions")
            .insert(
              body.permissions.map((p: { provider: string; scope: string; action_type: string; reason?: string }) => ({
                mission_id: mission.id,
                provider: p.provider,
                scope: p.scope,
                action_type: p.action_type,
                reason: p.reason ?? null,
              })),
            );
          if (permErr) throw permErr;
        }

        // Fire-and-forget push notification to user's devices
        const tetherNum = String(mission.tether_number).padStart(3, "0");
        const pushUrl = `${requireEnv("SUPABASE_URL")}/functions/v1/send-push`;
        const svcKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
        fetch(pushUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${svcKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            mission_id: mission.id,
            title: `Tether #${tetherNum} — Approval Required`,
            body: (mission.objective ?? "A new mission needs your approval.").slice(0, 120),
          }),
        }).catch((e: unknown) => console.error("send-push fire-and-forget failed:", e));

        return json({ data: mission });
      }

      // ── Update mission ──────────────────────────────────────────────
      case "update": {
        const { data, error } = await db
          .from("missions")
          .update(body.updates)
          .eq("id", body.id)
          .eq("user_id", userId)
          .select()
          .single();
        if (error) throw error;
        return json({ data });
      }

      // ── Get pending mission for mobile approval ─────────────────────
      case "get_pending": {
        if (body.id) {
          const { data, error } = await db
            .from("missions")
            .select("*")
            .eq("id", body.id)
            .eq("user_id", userId)
            .eq("status", "pending")
            .maybeSingle();
          if (error) throw error;
          return json({ data });
        }
        const { data, error } = await db
          .from("missions")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return json({ data });
      }

      // ── List mission permissions ────────────────────────────────────
      case "list_permissions": {
        const { data, error } = await db
          .from("mission_permissions")
          .select("*")
          .eq("mission_id", body.mission_id);
        if (error) throw error;
        return json({ data });
      }

      // ── Execution log ───────────────────────────────────────────────
      case "list_execution_log": {
        let q = db
          .from("execution_log")
          .select("*")
          .eq("user_id", userId)
          .order("timestamp", { ascending: false })
          .limit(body.limit ?? 100);
        if (body.mission_id) {
          q = q.eq("mission_id", body.mission_id);
        }
        const { data, error } = await q;
        if (error) throw error;
        return json({ data });
      }

      // ── Insert execution log entry ──────────────────────────────────
      case "insert_execution_log": {
        const entry = body.entry;
        const { data, error } = await db
          .from("execution_log")
          .insert({ ...entry, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return json({ data });
      }

      // ── Connected accounts ──────────────────────────────────────────
      case "list_connected_accounts": {
        const { data, error } = await db
          .from("connected_accounts")
          .select("id, provider, provider_username, scopes, connected_at, is_active, user_id")
          .eq("user_id", userId)
          .order("connected_at", { ascending: false });
        if (error) throw error;
        return json({ data });
      }

      // ── Mission stats ───────────────────────────────────────────────
      case "mission_stats": {
        const [missionsRes, logsRes] = await Promise.all([
          db.from("missions").select("id, status").eq("user_id", userId),
          db.from("execution_log").select("id, status").eq("user_id", userId),
        ]);
        if (missionsRes.error) throw missionsRes.error;
        if (logsRes.error) throw logsRes.error;

        const missions = missionsRes.data ?? [];
        const logs = logsRes.data ?? [];
        return json({
          data: {
            totalMissions: missions.length,
            actionsApproved: logs.filter((l: { status: string }) => l.status === "allowed").length,
            actionsBlocked: logs.filter((l: { status: string }) => l.status === "blocked").length,
          },
        });
      }

      // ── Analytics (missions + logs for charts) ───────────────────────
      case "analytics": {
        const [mRes, lRes] = await Promise.all([
          db.from("missions").select("id, status, risk_level, created_at").eq("user_id", userId),
          db.from("execution_log").select("id, status, timestamp").eq("user_id", userId),
        ]);
        if (mRes.error) throw mRes.error;
        if (lRes.error) throw lRes.error;
        return json({ data: { missions: mRes.data ?? [], logs: lRes.data ?? [] } });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message :
      typeof err === "object" && err !== null && "message" in err ? String((err as { message: unknown }).message) :
      JSON.stringify(err);
    console.error("missions-api error:", errMsg, err);
    const status = err instanceof AuthError ? err.status : 500;
    return json({ error: errMsg || "Internal error" }, status);
  }
});
