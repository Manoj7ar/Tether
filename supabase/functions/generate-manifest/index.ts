import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AuthError, requireAuth0User } from "../_shared/auth.ts";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an AI security analyst for Tether, an agent authorization platform. Given a user's natural language task description and a time limit, generate a precise mission authorization manifest.

You MUST call the "generate_manifest" tool with the structured manifest data. Analyze the task carefully to determine:
1. Which third-party services/providers are needed (e.g. GitHub, Gmail, Calendar, Slack, Jira)
2. What specific scopes/permissions each provider needs (use realistic OAuth-style scope names)
3. Whether each permission is "read" or "write"
4. Exactly what the agent WILL do (specific, actionable items)
5. Exactly what the agent WILL NOT do (explicit safety boundaries)
6. Risk level: "low" (read-only), "medium" (some writes), "high" (destructive or broad writes)
7. Any irreversible actions (e.g. sending emails, deleting data, posting publicly)
8. External data exposure level: "low" (no data leaves system), "medium" (data shared with specified parties), "high" (data exposed publicly)

Be precise and security-conscious. Err on the side of minimal permissions.`;

const AUDITOR_PROMPT = `You are an independent security auditor. You are given a task description and a proposed authorization manifest. Your only job is to verify whether the permissions requested are actually justified by the task. Be skeptical. Flag anything that looks like scope creep or unnecessary write access. Output ONLY valid JSON:
{
  "verdict": "passed|warning|failed",
  "reasoning": "one paragraph explanation",
  "flags": ["specific concern if any"],
  "suggested_removals": ["scope string if any"]
}`;

const NEGOTIATION_PROMPT = `You are a scope negotiation engine for Tether. Given a task description and a proposed manifest, identify permissions that are broader than the task actually requires. For each over-scoped permission, suggest a downgraded alternative with least-privilege principle.

Be specific: if the task is read-only triage but write access was requested, downgrade to read. If the task mentions a specific repo but all repos were requested, scope down.

You MUST call the "negotiate_scope" tool with the negotiation results.`;

interface ManifestPermission {
  actionType: "read" | "write";
  provider: string;
  scope: string;
}

interface ScopeNegotiationChange {
  downgraded_scope: string;
  original_scope: string;
  reason: string;
}

interface GeneratedManifest {
  externalDataExposure: "low" | "medium" | "high";
  irreversibleActions: string[];
  permissions: ManifestPermission[];
  riskLevel: "low" | "medium" | "high";
  willDo: string[];
  willNotDo: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await requireAuth0User(req);
    const { task, timeLimitMins } = await req.json();

    if (!task || typeof task !== "string") {
      return new Response(
        JSON.stringify({ error: "task is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = requireEnv("LOVABLE_API_KEY");

    const aiHeaders = {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    };

    // ========== CALL 1: Generate manifest ==========
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Task: "${task}"\nTime limit: ${timeLimitMins} minutes\n\nGenerate the authorization manifest for this mission.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_manifest",
              description: "Generate a structured mission authorization manifest",
              parameters: {
                type: "object",
                properties: {
                  permissions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        provider: { type: "string" },
                        scope: { type: "string" },
                        actionType: { type: "string", enum: ["read", "write"] },
                      },
                      required: ["provider", "scope", "actionType"],
                      additionalProperties: false,
                    },
                  },
                  willDo: { type: "array", items: { type: "string" } },
                  willNotDo: { type: "array", items: { type: "string" } },
                  riskLevel: { type: "string", enum: ["low", "medium", "high"] },
                  irreversibleActions: { type: "array", items: { type: "string" } },
                  externalDataExposure: { type: "string", enum: ["low", "medium", "high"] },
                },
                required: ["permissions", "willDo", "willNotDo", "riskLevel", "irreversibleActions", "externalDataExposure"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_manifest" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "generate_manifest") {
      throw new Error("AI did not return expected tool call");
    }

    const manifest = JSON.parse(toolCall.function.arguments) as GeneratedManifest;

    // ========== CALL 2: Independent intent verification ==========
    let intentVerification = {
      verdict: "passed" as string,
      reasoning: "Independent audit was not available.",
      flags: [] as string[],
      suggested_removals: [] as string[],
    };

    // ========== CALL 3: Scope Negotiation ==========
    let scopeNegotiation: { negotiated: boolean; changes: ScopeNegotiationChange[] } = { negotiated: false, changes: [] };

    // Run audit and negotiation in parallel
    const [auditResult, negotiationResult] = await Promise.allSettled([
      // Audit
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: AUDITOR_PROMPT },
            {
              role: "user",
              content: `Task description: "${task}"\n\nProposed manifest:\n${JSON.stringify(manifest, null, 2)}\n\nVerify whether these permissions are justified. Return ONLY valid JSON.`,
            },
          ],
        }),
      }),
      // Negotiation
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: NEGOTIATION_PROMPT },
            {
              role: "user",
              content: `Task: "${task}"\n\nManifest permissions:\n${JSON.stringify(manifest.permissions, null, 2)}\n\nIdentify any over-scoped permissions and suggest downgrades.`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "negotiate_scope",
                description: "Return scope negotiation results",
                parameters: {
                  type: "object",
                  properties: {
                    negotiated: { type: "boolean", description: "Whether any scopes were downgraded" },
                    changes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          original_scope: { type: "string" },
                          downgraded_scope: { type: "string" },
                          reason: { type: "string" },
                        },
                        required: ["original_scope", "downgraded_scope", "reason"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["negotiated", "changes"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "negotiate_scope" } },
        }),
      }),
    ]);

    // Process audit result
    if (auditResult.status === "fulfilled") {
      const auditResponse = auditResult.value;
      if (auditResponse.ok) {
        const auditData = await auditResponse.json();
        const auditContent = auditData.choices?.[0]?.message?.content || "";
        const jsonMatch = auditContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            intentVerification = {
              verdict: parsed.verdict || "passed",
              reasoning: parsed.reasoning || "No reasoning provided.",
              flags: parsed.flags || [],
              suggested_removals: parsed.suggested_removals || [],
            };
          } catch (error) {
            console.error("Failed to parse audit result:", error);
          }
        }
      }
    }

    // Process negotiation result
    if (negotiationResult.status === "fulfilled") {
      const negResponse = negotiationResult.value;
      if (negResponse.ok) {
        const negData = await negResponse.json();
        const negToolCall = negData.choices?.[0]?.message?.tool_calls?.[0];
        if (negToolCall) {
          try {
            const negResult = JSON.parse(negToolCall.function.arguments) as {
              changes: ScopeNegotiationChange[];
              negotiated: boolean;
            };
            if (negResult.negotiated && negResult.changes?.length > 0) {
              scopeNegotiation = negResult;

              // Apply downgrades to manifest permissions
              for (const change of negResult.changes) {
                const perm = manifest.permissions.find(
                  (permission) => `${permission.provider}:${permission.scope}`.toLowerCase().includes(change.original_scope.toLowerCase())
                );
                if (perm) {
                  // Downgrade write to read if applicable
                  if (change.downgraded_scope.toLowerCase().includes("read") && perm.actionType === "write") {
                    perm.actionType = "read";
                  }
                  perm.scope = change.downgraded_scope;
                }
              }
            }
          } catch (error) {
            console.error("Failed to parse negotiation result:", error);
          }
        }
      }
    }

    // Enrich with metadata
    const now = new Date();
    const enriched = {
      tetherNumber: "—",
      createdAt: now.toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZoneName: "short",
      }),
      expiryLabel: `${timeLimitMins} minutes from approval`,
      objective: task,
      ...manifest,
      intentVerification,
      scopeNegotiation,
    };

    return new Response(JSON.stringify({ manifest: enriched }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-manifest error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: e instanceof AuthError ? e.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
