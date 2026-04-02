import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AuthError, requireAuth0User } from "../_shared/auth.ts";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: object, status = 200) {
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
    const url = new URL(req.url);
    const missionId = url.searchParams.get("mission_id");
    if (!missionId) {
      return jsonResponse({ error: "mission_id is required" }, 400);
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id")
      .eq("id", missionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (missionError || !mission) {
      return jsonResponse({ error: "Mission not found" }, 404);
    }

    const { data: row } = await supabase
      .from("step_up_verifications")
      .select("github_verified_at, google_verified_at, expires_at")
      .eq("user_id", userId)
      .eq("mission_id", missionId)
      .maybeSingle();

    if (!row) {
      return jsonResponse({
        verification: null,
      });
    }

    const now = Date.now();
    const expired = row.expires_at && new Date(row.expires_at).getTime() <= now;

    return jsonResponse({
      verification: expired
        ? null
        : {
          github_verified_at: row.github_verified_at,
          google_verified_at: row.google_verified_at,
          expires_at: row.expires_at,
        },
    });
  } catch (error) {
    console.error("step-up-status error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof AuthError || message === "Unauthorized" ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
