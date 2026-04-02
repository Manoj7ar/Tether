import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TrustHistoryEntry {
  date: string;
  score: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all execution logs for this user
    const { data: logs, error: logsErr } = await supabase
      .from("execution_log")
      .select("status, timestamp")
      .eq("user_id", user_id)
      .order("timestamp", { ascending: false });

    if (logsErr) throw logsErr;

    const allLogs = logs || [];
    if (allLogs.length === 0) {
      // No activity, default score
      const { error: upsertErr } = await supabase
        .from("agent_trust_scores")
        .upsert({
          user_id,
          score: 100,
          total_allowed: 0,
          total_blocked: 0,
          history_json: [{ date: new Date().toISOString().split("T")[0], score: 100 }],
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (upsertErr) throw upsertErr;

      return new Response(JSON.stringify({ score: 100 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let weightedAllowed = 0;
    let weightedBlocked = 0;
    let totalAllowed = 0;
    let totalBlocked = 0;

    for (const log of allLogs) {
      const isRecent = new Date(log.timestamp) >= sevenDaysAgo;
      const weight = isRecent ? 2 : 1;

      if (log.status === "allowed") {
        weightedAllowed += weight;
        totalAllowed++;
      } else if (log.status === "blocked") {
        weightedBlocked += weight;
        totalBlocked++;
      }
    }

    const totalWeighted = weightedAllowed + weightedBlocked;
    const score = totalWeighted > 0
      ? Math.round((weightedAllowed / totalWeighted) * 100)
      : 100;

    // Get existing history
    const { data: existing } = await supabase
      .from("agent_trust_scores")
      .select("history_json")
      .eq("user_id", user_id)
      .maybeSingle();

    const history = Array.isArray(existing?.history_json) ? existing.history_json as TrustHistoryEntry[] : [];
    const today = new Date().toISOString().split("T")[0];

    // Update today's entry or add new one
    const lastEntry = history[history.length - 1];
    if (lastEntry?.date === today) {
      lastEntry.score = score;
    } else {
      history.push({ date: today, score });
    }

    // Keep last 30 entries
    const trimmedHistory = history.slice(-30);

    const { error: upsertErr } = await supabase
      .from("agent_trust_scores")
      .upsert({
        user_id,
        score,
        total_allowed: totalAllowed,
        total_blocked: totalBlocked,
        history_json: trimmedHistory,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertErr) throw upsertErr;

    return new Response(JSON.stringify({ score, totalAllowed, totalBlocked }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calculate-trust-score error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
