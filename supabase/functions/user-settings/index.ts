import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AuthError, requireAuth0User } from "../_shared/auth.ts";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type SettingsRow = {
  id: string;
  user_id: string;
  demo_mode: boolean;
  mcp_enabled: boolean;
  ambient_enabled: boolean;
  ambient_budget_max: number;
  ambient_budget_used: number;
  ambient_budget_window_start: string | null;
  ambient_allowed_actions: unknown;
  updated_at: string;
};

function normalizeRow(row: SettingsRow) {
  return {
    ...row,
    demo_mode: Boolean(row.demo_mode),
    ambient_allowed_actions: Array.isArray(row.ambient_allowed_actions)
      ? (row.ambient_allowed_actions as string[])
      : [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { userId } = await requireAuth0User(req);
    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    if (req.method === "GET") {
      const { data: existing, error: selErr } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (selErr) {
        throw selErr;
      }

      if (existing) {
        return json({ settings: normalizeRow(existing as SettingsRow) });
      }

      const now = new Date().toISOString();
      const { data: created, error: insErr } = await supabase
        .from("user_settings")
        .insert({
          user_id: userId,
          demo_mode: false,
          mcp_enabled: false,
          ambient_enabled: false,
          ambient_budget_max: 50,
          ambient_budget_used: 0,
          ambient_budget_window_start: now,
          ambient_allowed_actions: [],
          updated_at: now,
        })
        .select()
        .single();

      if (insErr) {
        if (insErr.code === "23505") {
          const { data: raced, error: raceErr } = await supabase
            .from("user_settings")
            .select("*")
            .eq("user_id", userId)
            .single();
          if (raceErr) throw raceErr;
          return json({ settings: normalizeRow(raced as SettingsRow) });
        }
        throw insErr;
      }

      return json({ settings: normalizeRow(created as SettingsRow) });
    }

    if (req.method === "POST") {
      const patch = await req.json() as {
        demo_mode?: boolean;
        mcp_enabled?: boolean;
        ambient_enabled?: boolean;
        ambient_budget_max?: number;
        ambient_budget_used?: number;
        ambient_budget_window_start?: string;
        ambient_allowed_actions?: string[];
      };

      const { data: existing, error: selErr } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (selErr) {
        throw selErr;
      }

      const base = existing as SettingsRow | null;
      const now = new Date().toISOString();

      const merged = {
        user_id: userId,
        demo_mode: typeof patch.demo_mode === "boolean"
          ? patch.demo_mode
          : (base?.demo_mode ?? false),
        mcp_enabled: typeof patch.mcp_enabled === "boolean"
          ? patch.mcp_enabled
          : (base?.mcp_enabled ?? false),
        ambient_enabled: typeof patch.ambient_enabled === "boolean"
          ? patch.ambient_enabled
          : (base?.ambient_enabled ?? false),
        ambient_budget_max: typeof patch.ambient_budget_max === "number"
          ? patch.ambient_budget_max
          : (base?.ambient_budget_max ?? 50),
        ambient_budget_used: typeof patch.ambient_budget_used === "number"
          ? patch.ambient_budget_used
          : (base?.ambient_budget_used ?? 0),
        ambient_budget_window_start: typeof patch.ambient_budget_window_start === "string"
          ? patch.ambient_budget_window_start
          : (base?.ambient_budget_window_start ?? now),
        ambient_allowed_actions: Array.isArray(patch.ambient_allowed_actions)
          ? patch.ambient_allowed_actions
          : (Array.isArray(base?.ambient_allowed_actions)
            ? base!.ambient_allowed_actions
            : []),
        updated_at: now,
      };

      if (base) {
        const { data: updated, error: upErr } = await supabase
          .from("user_settings")
          .update(merged)
          .eq("user_id", userId)
          .select()
          .single();
        if (upErr) {
          throw upErr;
        }
        return json({ settings: normalizeRow(updated as SettingsRow) });
      }

      const { data: inserted, error: insErr } = await supabase
        .from("user_settings")
        .insert(merged)
        .select()
        .single();
      if (insErr) {
        if (insErr.code === "23505") {
          const { data: updated, error: upAfterRace } = await supabase
            .from("user_settings")
            .update(merged)
            .eq("user_id", userId)
            .select()
            .single();
          if (upAfterRace) throw upAfterRace;
          return json({ settings: normalizeRow(updated as SettingsRow) });
        }
        throw insErr;
      }
      return json({ settings: normalizeRow(inserted as SettingsRow) });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("user-settings error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof AuthError ? error.status : 500;
    return json({ error: message }, status);
  }
});
