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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await requireAuth0User(req);
    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

    if (req.method === "POST") {
      const { subscription } = await req.json();
      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return json({ error: "Invalid push subscription object" }, 400);
      }

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            endpoint: subscription.endpoint,
            keys_p256dh: subscription.keys.p256dh,
            keys_auth: subscription.keys.auth,
          },
          { onConflict: "endpoint" },
        );

      if (error) throw error;
      return json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { endpoint } = await req.json();
      if (!endpoint) return json({ error: "endpoint required" }, 400);

      const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", endpoint);

      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error("push-subscribe error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof AuthError ? error.status : 500;
    return json({ error: message }, status);
  }
});
