/**
 * Missions CRUD Edge Function.
 *
 * Uses a lightweight auth approach (Auth0 /userinfo) to avoid importing
 * the heavy jose library, keeping memory usage low.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw Object.assign(new Error(`${name} not configured`), { status: 503 });
  return v;
}

async function authenticateRequest(req: Request): Promise<string> {
  const hdr = req.headers.get("Authorization");
  if (!hdr?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }

  const token = hdr.slice(7);
  const domain = env("AUTH0_DOMAIN").replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  const res = await fetch(`https://${domain}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw Object.assign(new Error("Invalid or expired session"), { status: 401 });
  }

  const profile = await res.json();
  if (!profile.sub) {
    throw Object.assign(new Error("Auth0 did not return a user ID"), { status: 401 });
  }

  return profile.sub as string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const userId = await authenticateRequest(req);
    const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

    const rawText = await req.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawText);
    } catch {
      return json({ error: "Invalid request body" }, 400);
    }
    const action = body.action as string;

    switch (action) {
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

      case "create": {
        const m = body.mission as Record<string, unknown>;
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
          const perms = body.permissions as { provider: string; scope: string; action_type: string; reason?: string }[];
          const { error: permErr } = await db
            .from("mission_permissions")
            .insert(perms.map((p) => ({
              mission_id: mission.id,
              provider: p.provider,
              scope: p.scope,
              action_type: p.action_type,
              reason: p.reason ?? null,
            })));
          if (permErr) throw permErr;
        }

        const tetherNum = String(mission.tether_number).padStart(3, "0");
        const pushUrl = `${env("SUPABASE_URL")}/functions/v1/send-push`;
        fetch(pushUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            user_id: userId,
            mission_id: mission.id,
            title: `Tether #${tetherNum} — Approval Required`,
            body: ((mission.objective as string) ?? "A new mission needs your approval.").slice(0, 120),
          }),
        }).catch((e: unknown) => console.error("send-push fire-and-forget failed:", e));

        return json({ data: mission });
      }

      case "update": {
        const { data, error } = await db
          .from("missions")
          .update(body.updates as Record<string, unknown>)
          .eq("id", body.id)
          .eq("user_id", userId)
          .select()
          .single();
        if (error) throw error;
        return json({ data });
      }

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

      case "list_permissions": {
        const { data, error } = await db
          .from("mission_permissions")
          .select("*")
          .eq("mission_id", body.mission_id);
        if (error) throw error;
        return json({ data });
      }

      case "list_execution_log": {
        let q = db
          .from("execution_log")
          .select("*")
          .eq("user_id", userId)
          .order("timestamp", { ascending: false })
          .limit((body.limit as number) ?? 100);
        if (body.mission_id) {
          q = q.eq("mission_id", body.mission_id);
        }
        const { data, error } = await q;
        if (error) throw error;
        return json({ data });
      }

      case "insert_execution_log": {
        const entry = body.entry as Record<string, unknown>;
        const { data, error } = await db
          .from("execution_log")
          .insert({ ...entry, user_id: userId })
          .select()
          .single();
        if (error) throw error;
        return json({ data });
      }

      case "list_connected_accounts": {
        const { data, error } = await db
          .from("connected_accounts")
          .select("id, provider, provider_username, scopes, connected_at, is_active, user_id")
          .eq("user_id", userId)
          .order("connected_at", { ascending: false });
        if (error) throw error;
        return json({ data });
      }

      case "mission_stats": {
        const [mRes, lRes] = await Promise.all([
          db.from("missions").select("id, status").eq("user_id", userId),
          db.from("execution_log").select("id, status").eq("user_id", userId),
        ]);
        if (mRes.error) throw mRes.error;
        if (lRes.error) throw lRes.error;
        const missions = mRes.data ?? [];
        const logs = lRes.data ?? [];
        return json({
          data: {
            totalMissions: missions.length,
            actionsApproved: logs.filter((l: { status: string }) => l.status === "allowed").length,
            actionsBlocked: logs.filter((l: { status: string }) => l.status === "blocked").length,
          },
        });
      }

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
    const errObj = err as { message?: string; status?: number };
    const message = errObj.message || "Internal error";
    const status = errObj.status ?? 500;
    if (status >= 500) console.error("missions-api error:", message);
    return json({ error: message }, status);
  }
});
