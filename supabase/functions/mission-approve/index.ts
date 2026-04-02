import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCapableActionIdsFromPermissions,
  missionRequiresStepUpApproval,
} from "../../../shared/mission-actions.ts";
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond({ error: "Unauthorized" }, 401);
    }

    const { userId } = await requireAuth0User(req);
    const body = await req.json() as { mission_id?: string };
    const missionId = body.mission_id;

    if (!missionId) {
      return respond({ error: "mission_id is required" }, 400);
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("id, user_id, status, time_limit_mins")
      .eq("id", missionId)
      .eq("user_id", userId)
      .single();

    if (missionError || !mission) {
      return respond({ error: "Mission not found" }, 404);
    }

    if (mission.status !== "pending") {
      return respond({ error: `Mission is not pending approval (status: ${mission.status})` }, 409);
    }

    const { data: permissionRows } = await supabase
      .from("mission_permissions")
      .select("provider, scope")
      .eq("mission_id", missionId);

    const capableIds = getCapableActionIdsFromPermissions(permissionRows ?? []);
    if (missionRequiresStepUpApproval(capableIds)) {
      const needsGithub = capableIds.includes("github.delete_repo");
      const needsGoogle = capableIds.includes("gmail.download_all");

      const { data: stepRow } = await supabase
        .from("step_up_verifications")
        .select("github_verified_at, google_verified_at, expires_at")
        .eq("user_id", userId)
        .eq("mission_id", missionId)
        .maybeSingle();

      const now = Date.now();
      const validExpiry = stepRow?.expires_at && new Date(stepRow.expires_at).getTime() > now;

      if (!validExpiry) {
        return respond({
          error: "Step-up verification required before approving this mission",
          blocked: true,
          block_type: "step_up_required",
        }, 403);
      }

      if (needsGithub && !stepRow?.github_verified_at) {
        return respond({
          error: "Re-authenticate with GitHub before approving",
          blocked: true,
          block_type: "step_up_required",
        }, 403);
      }

      if (needsGoogle && !stepRow?.google_verified_at) {
        return respond({
          error: "Re-authenticate with Google before approving",
          blocked: true,
          block_type: "step_up_required",
        }, 403);
      }
    }

    const mins = mission.time_limit_mins ?? 30;
    const approvedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + mins * 60000).toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("missions")
      .update({
        status: "active",
        approved_at: approvedAt,
        expires_at: expiresAt,
      })
      .eq("id", missionId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return respond({ mission: updated }, 200);
  } catch (error) {
    console.error("mission-approve error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof AuthError ? error.status : 500;
    return respond({ error: message }, status);
  }
});
