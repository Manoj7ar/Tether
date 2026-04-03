import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAiApiKey, getAiChatCompletionsUrl, getAiCompatModel } from "../_shared/ai-gateway.ts";
import { AuthError, requireAuth0User } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a security policy generator for Tether, an agent authorization platform. Convert natural language policy descriptions into structured policy rules.

Each rule has this structure:
- action: a "provider.action" string (e.g. "gmail.send_email", "github.delete_repo", "github.push_code", "calendar.delete_event")
- enabled: boolean (always true for new rules)
- conditions: object with relevant keys like:
  - allowed: boolean (false to block entirely)
  - allowed_domains: string[] (for email domain restrictions)
  - block_external: boolean (for email policies)
  - allowed_repos: string[] (for repo restrictions)
  - blocked_repos: string[] (for repo restrictions)
  - reason: string (human-readable explanation)

Generate 1-3 rules that accurately represent the user's intent. Be precise with action names.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth0User(req);
    const { description } = await req.json();
    if (!description) {
      return new Response(JSON.stringify({ error: "description required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(getAiChatCompletionsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAiApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getAiCompatModel(),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Convert this policy to structured rules: "${description}"` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_policy_rules",
              description: "Create structured policy rules from natural language",
              parameters: {
                type: "object",
                properties: {
                  rules: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action: { type: "string", description: "provider.action format" },
                        enabled: { type: "boolean" },
                        conditions: {
                          type: "object",
                          description: "Condition key-value pairs",
                        },
                      },
                      required: ["action", "enabled", "conditions"],
                      additionalProperties: false,
                    },
                  },
                  explanation: { type: "string", description: "Brief explanation of the generated rules" },
                },
                required: ["rules", "explanation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_policy_rules" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return expected tool call");

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-policy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: e instanceof AuthError ? e.status : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
