import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AuthError, requireAuth0User } from "../_shared/auth.ts";
import { requireEnv } from "../_shared/env.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireAuth0User(req);
    const body = await req.json();

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .insert({
        objective: body.objective,
        time_limit_mins: body.time_limit_mins,
        manifest_json: body.manifest_json ?? null,
        risk_level: body.risk_level ?? null,
        intent_audit: body.intent_audit ?? null,
        user_id: userId,
        status: "pending",
      })
      .select()
      .single();

    if (missionError) {
      console.error("insert mission error:", missionError);
      return respond({ error: missionError.message }, 500);
    }

    if (Array.isArray(body.permissions) && body.permissions.length > 0) {
      const permRows = body.permissions.map((p: { provider: string; scope: string; action_type: string; reason?: string }) => ({
        mission_id: mission.id,
        provider: p.provider,
        scope: p.scope,
        action_type: p.action_type,
        reason: p.reason ?? null,
      }));
      await supabase.from("mission_permissions").insert(permRows);
    }

    const tetherNum = String(mission.tether_number).padStart(3, "0");
    fetch(`${requireEnv("SUPABASE_URL")}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${requireEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        user_id: userId,
        mission_id: mission.id,
        title: `Tether #${tetherNum} — Approval Required`,
        body: (mission.objective ?? "A new mission needs your approval.").slice(0, 120),
      }),
    }).catch((e: unknown) => console.error("send-push fire-and-forget:", e));

    return respond({ data: mission }, 200);
  } catch (error) {
    console.error("create-mission error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof AuthError ? error.status : 500;
    return respond({ error: message }, status);
  }
});
