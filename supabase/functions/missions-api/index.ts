/**
 * Missions CRUD — zero-dependency Edge Function.
 * Uses raw fetch against the PostgREST API instead of the Supabase JS
 * client to stay well under the Edge Function memory limit.
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function env(n: string): string {
  const v = Deno.env.get(n);
  if (!v) throw { message: `${n} not configured`, status: 503 };
  return v;
}

async function auth(req: Request): Promise<string> {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) throw { message: "Unauthorized", status: 401 };
  const domain = env("AUTH0_DOMAIN").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const r = await fetch(`https://${domain}/userinfo`, { headers: { Authorization: h } });
  if (!r.ok) throw { message: "Invalid or expired session", status: 401 };
  const p = await r.json();
  if (!p.sub) throw { message: "No user ID", status: 401 };
  return p.sub as string;
}

type PgResult = Record<string, unknown>[];

async function pg(
  method: string,
  table: string,
  opts: {
    query?: string;
    body?: unknown;
    single?: boolean;
    prefer?: string;
  } = {},
): Promise<{ data: unknown; error: string | null }> {
  const url = `${env("SUPABASE_URL")}/rest/v1/${table}${opts.query ? `?${opts.query}` : ""}`;
  const headers: Record<string, string> = {
    apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
    Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
    "Content-Type": "application/json",
  };
  if (opts.prefer) headers["Prefer"] = opts.prefer;
  if (opts.single) headers["Accept"] = "application/vnd.pgrst.object+json";
  else headers["Accept"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    return { data: null, error: (err as { message?: string }).message || res.statusText };
  }

  if (res.status === 204) return { data: null, error: null };
  const data = await res.json();
  return { data, error: null };
}

function qs(params: Record<string, string>): string {
  return Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    const userId = await auth(req);
    const raw = await req.text();
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return jsonRes({ error: "Invalid body" }, 400); }
    const action = body.action as string;

    switch (action) {
      case "list": {
        const f = body.statusFilter && body.statusFilter !== "all" ? `&status=eq.${body.statusFilter}` : "";
        const { data, error } = await pg("GET", "missions", {
          query: `user_id=eq.${userId}&order=created_at.desc${f}&select=*`,
        });
        if (error) throw { message: error, status: 500 };
        return jsonRes({ data });
      }

      case "list_active": {
        const { data, error } = await pg("GET", "missions", {
          query: `user_id=eq.${userId}&status=in.(active,pending)&order=created_at.desc&select=*`,
        });
        if (error) throw { message: error, status: 500 };
        return jsonRes({ data });
      }

      case "get": {
        const { data, error } = await pg("GET", "missions", {
          query: `id=eq.${body.id}&user_id=eq.${userId}&select=*`,
          single: true,
        });
        if (error) throw { message: error, status: 500 };
        return jsonRes({ data });
      }

      case "create": {
        const m = body.mission as Record<string, unknown>;
        const { data: mission, error } = await pg("POST", "missions", {
          query: "select=*",
          body: {
            objective: m.objective,
            time_limit_mins: m.time_limit_mins,
            manifest_json: m.manifest_json ?? null,
            risk_level: m.risk_level ?? null,
            intent_audit: m.intent_audit ?? null,
            user_id: userId,
            status: "pending",
          },
          single: true,
          prefer: "return=representation",
        });
        if (error) throw { message: error, status: 500 };

        const perms = body.permissions as { provider: string; scope: string; action_type: string; reason?: string }[] | undefined;
        if (Array.isArray(perms) && perms.length > 0) {
          const missionObj = mission as { id: string };
          await pg("POST", "mission_permissions", {
            body: perms.map((p) => ({
              mission_id: missionObj.id,
              provider: p.provider,
              scope: p.scope,
              action_type: p.action_type,
              reason: p.reason ?? null,
            })),
            prefer: "return=minimal",
          });
        }

        const mObj = mission as { id: string; tether_number: number; objective: string };
        const tetherNum = String(mObj.tether_number).padStart(3, "0");
        fetch(`${env("SUPABASE_URL")}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            user_id: userId,
            mission_id: mObj.id,
            title: `Tether #${tetherNum} — Approval Required`,
            body: (mObj.objective ?? "A new mission needs your approval.").slice(0, 120),
          }),
        }).catch(() => {});

        return jsonRes({ data: mission });
      }

      case "update": {
        const { data, error } = await pg("PATCH", "missions", {
          query: `id=eq.${body.id}&user_id=eq.${userId}&select=*`,
          body: body.updates,
          single: true,
          prefer: "return=representation",
        });
        if (error) throw { message: error, status: 500 };
        return jsonRes({ data });
      }

      case "get_pending": {
        const idFilter = body.id ? `id=eq.${body.id}&` : "";
        const { data, error } = await pg("GET", "missions", {
          query: `${idFilter}user_id=eq.${userId}&status=eq.pending&order=created_at.desc&limit=1&select=*`,
          single: true,
        });
        if (error && !error.includes("JSON object requested")) throw { message: error, status: 500 };
        return jsonRes({ data: data ?? null });
      }

      case "list_permissions": {
        const { data, error } = await pg("GET", "mission_permissions", {
          query: `mission_id=eq.${body.mission_id}&select=*`,
        });
        if (error) throw { message: error, status: 500 };
        return jsonRes({ data });
      }

      case "list_execution_log": {
        const mf = body.mission_id ? `&mission_id=eq.${body.mission_id}` : "";
        const { data, error } = await pg("GET", "execution_log", {
          query: `user_id=eq.${userId}&order=timestamp.desc&limit=${body.limit ?? 100}${mf}&select=*`,
        });
        if (error) throw { message: error, status: 500 };
        return jsonRes({ data });
      }

      case "insert_execution_log": {
        const entry = body.entry as Record<string, unknown>;
        const { data, error } = await pg("POST", "execution_log", {
          query: "select=*",
          body: { ...entry, user_id: userId },
          single: true,
          prefer: "return=representation",
        });
        if (error) throw { message: error, status: 500 };
        return jsonRes({ data });
      }

      case "list_connected_accounts": {
        const { data, error } = await pg("GET", "connected_accounts", {
          query: `user_id=eq.${userId}&order=connected_at.desc&select=id,provider,provider_username,scopes,connected_at,is_active,user_id`,
        });
        if (error) throw { message: error, status: 500 };
        return jsonRes({ data });
      }

      case "mission_stats": {
        const [mRes, lRes] = await Promise.all([
          pg("GET", "missions", { query: `user_id=eq.${userId}&select=id,status` }),
          pg("GET", "execution_log", { query: `user_id=eq.${userId}&select=id,status` }),
        ]);
        if (mRes.error) throw { message: mRes.error, status: 500 };
        if (lRes.error) throw { message: lRes.error, status: 500 };
        const missions = (mRes.data ?? []) as PgResult;
        const logs = (lRes.data ?? []) as PgResult;
        return jsonRes({
          data: {
            totalMissions: missions.length,
            actionsApproved: logs.filter((l) => l.status === "allowed").length,
            actionsBlocked: logs.filter((l) => l.status === "blocked").length,
          },
        });
      }

      case "analytics": {
        const [mRes, lRes] = await Promise.all([
          pg("GET", "missions", { query: `user_id=eq.${userId}&select=id,status,risk_level,created_at` }),
          pg("GET", "execution_log", { query: `user_id=eq.${userId}&select=id,status,timestamp` }),
        ]);
        if (mRes.error) throw { message: mRes.error, status: 500 };
        if (lRes.error) throw { message: lRes.error, status: 500 };
        return jsonRes({ data: { missions: mRes.data ?? [], logs: lRes.data ?? [] } });
      }

      default:
        return jsonRes({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    const e = err as { message?: string; status?: number };
    if ((e.status ?? 500) >= 500) console.error("missions-api:", e.message);
    return jsonRes({ error: e.message || "Internal error" }, e.status ?? 500);
  }
});
