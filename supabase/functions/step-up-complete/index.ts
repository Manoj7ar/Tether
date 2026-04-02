import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AuthError, requireAuth0User } from "../_shared/auth.ts";
import { requireEnv } from "../_shared/env.ts";
import { stepUpVerificationTtlIso } from "../../../shared/mission-actions.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Provider = "GitHub" | "Gmail" | "Google Calendar" | "Slack";

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function columnForProvider(provider: Provider): "github_verified_at" | "google_verified_at" {
  if (provider === "GitHub") return "github_verified_at";
  return "google_verified_at";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireAuth0User(req);
    const body = await req.json() as { missionId?: string; provider?: Provider };
    const missionId = body.missionId;
    const provider = body.provider;

    if (!missionId || !provider) {
      return jsonResponse({ error: "missionId and provider are required" }, 400);
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id, user_id, status")
      .eq("id", missionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (missionError || !mission) {
      return jsonResponse({ error: "Mission not found" }, 404);
    }

    const now = new Date().toISOString();
    const expiresAt = stepUpVerificationTtlIso();
    const col = columnForProvider(provider);
    const patch = {
      user_id: userId,
      mission_id: missionId,
      expires_at: expiresAt,
      updated_at: now,
      [col]: now,
    };

    const { error: upsertError } = await supabase
      .from("step_up_verifications")
      .upsert(patch, { onConflict: "user_id,mission_id" });

    if (upsertError) {
      throw upsertError;
    }

    return jsonResponse({ success: true, expires_at: expiresAt });
  } catch (error) {
    console.error("step-up-complete error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof AuthError || message === "Unauthorized" ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
