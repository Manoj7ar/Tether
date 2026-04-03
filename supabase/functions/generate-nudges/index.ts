import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAiApiKey, getAiChatCompletionsUrl } from "../_shared/ai-gateway.ts";
import { AuthError, requireAuth0User } from "../_shared/auth.ts";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireAuth0User(req);

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // Check if nudges are fresh (< 6 hours old)
    const { data: existingNudges } = await supabase
      .from("user_nudges")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingNudges) {
      const generatedAt = new Date(existingNudges.generated_at);
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      if (generatedAt > sixHoursAgo) {
        return new Response(JSON.stringify({ nudges: existingNudges.nudges_json, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch recent data for analysis
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [logsRes, missionsRes] = await Promise.all([
      supabase.from("execution_log").select("action, status, block_type, block_reason, timestamp")
        .eq("user_id", userId).gte("timestamp", thirtyDaysAgo).order("timestamp", { ascending: false }).limit(200),
      supabase.from("missions").select("objective, status, risk_level, created_at")
        .eq("user_id", userId).gte("created_at", thirtyDaysAgo).order("created_at", { ascending: false }).limit(50),
    ]);

    const logs = logsRes.data || [];
    const missions = missionsRes.data || [];

    if (logs.length === 0 && missions.length === 0) {
      return new Response(JSON.stringify({ nudges: [], cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Summarize data for AI
    const actionCounts: Record<string, { allowed: number; blocked: number }> = {};
    for (const log of logs) {
      if (!actionCounts[log.action]) actionCounts[log.action] = { allowed: 0, blocked: 0 };
      if (log.status === "allowed") actionCounts[log.action].allowed++;
      else if (log.status === "blocked") actionCounts[log.action].blocked++;
    }

    const summary = {
      totalActions: logs.length,
      totalMissions: missions.length,
      actionBreakdown: actionCounts,
      recentMissionRiskLevels: missions.map(m => m.risk_level).filter(Boolean),
      blockedActions: logs.filter(l => l.status === "blocked").map(l => ({
        action: l.action, reason: l.block_reason,
      })).slice(0, 10),
    };

    const response = await fetch(getAiChatCompletionsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAiApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a behavioral analyst for Tether, an agent authorization platform. Analyze the user's agent activity patterns and generate 1-3 actionable nudges. Nudge types:
- "suggestion": Recommend adding commonly used scopes to always-allow lists
- "warning": Flag unusual patterns like broader-than-normal scope requests
- "optimization": Suggest removing unused permissions from future missions

Keep nudges concise, specific, and actionable. Reference actual action names from the data.`,
          },
          {
            role: "user",
            content: `Analyze this agent activity data and generate nudges:\n${JSON.stringify(summary, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_nudges",
              description: "Generate behavioral nudges based on agent activity patterns",
              parameters: {
                type: "object",
                properties: {
                  nudges: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["suggestion", "warning", "optimization"] },
                        title: { type: "string" },
                        body: { type: "string" },
                      },
                      required: ["type", "title", "body"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["nudges"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_nudges" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return expected tool call");

    const result = JSON.parse(toolCall.function.arguments);
    const nudges = result.nudges || [];

    // Upsert nudges
    await supabase.from("user_nudges").upsert({
      user_id: userId,
      nudges_json: nudges,
      generated_at: new Date().toISOString(),
      dismissed_ids: existingNudges?.dismissed_ids || [],
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ nudges, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-nudges error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: e instanceof AuthError ? e.status : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
