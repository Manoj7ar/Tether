import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasRequiredScope, missionActionRegistry } from "../../../shared/mission-actions.ts";
import { requireAuth0User } from "../_shared/auth.ts";
import { requireEnv } from "../_shared/env.ts";

const app = new Hono();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const JSONRPC_VERSION = "2.0";
const MCP_PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "tether-mcp", version: "1.1.0" };

interface MissionPermissionRow {
  action_type: string;
  mission_id: string;
  provider: string;
  reason: string | null;
  scope: string;
}

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
  };
  _action: string;
  _missionId: string;
}

function jsonrpcResponse(id: string | number | null, result: unknown) {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

function jsonrpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: JSONRPC_VERSION, id, error: { code, message } };
}

async function getActivePermissions(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: missions } = await supabase
    .from("missions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (!missions || missions.length === 0) {
    return [];
  }

  const missionIds = missions.map((mission) => mission.id);
  const { data: permissions } = await supabase
    .from("mission_permissions")
    .select("*")
    .in("mission_id", missionIds);

  return (permissions ?? []) as MissionPermissionRow[];
}

function permissionsToTools(permissions: MissionPermissionRow[]): McpTool[] {
  const toolMap = new Map<string, McpTool>();

  for (const permission of permissions) {
    const providerPermissions = permissions.filter((candidate) => candidate.mission_id === permission.mission_id);

    for (const definition of missionActionRegistry) {
      const sameProvider = providerPermissions.some((candidate) => candidate.provider === definition.provider);
      if (!sameProvider || toolMap.has(`${permission.mission_id}:${definition.id}`)) {
        continue;
      }

      const grantedScopes = providerPermissions
        .filter((candidate) => candidate.provider === definition.provider)
        .map((candidate) => candidate.scope);

      if (!hasRequiredScope(definition, grantedScopes)) {
        continue;
      }

      toolMap.set(`${permission.mission_id}:${definition.id}`, {
        name: `${definition.id}__${permission.mission_id}`,
        description: `${definition.description}${permission.reason ? ` (${permission.reason})` : ""}`,
        inputSchema: {
          type: "object",
          properties: Object.fromEntries(
            Object.entries(definition.paramsSchema).map(([name, type]) => [
              name,
              {
                type: type === "string[]" ? "array" : type,
                description: `Parameter "${name}" for ${definition.title}`,
              },
            ]),
          ),
        },
        _action: definition.id,
        _missionId: permission.mission_id,
      });
    }
  }

  return Array.from(toolMap.values());
}

app.options("/*", (context) => {
  return context.newResponse(null, 204, corsHeaders);
});

app.post("/*", async (context) => {
  const accept = context.req.header("accept") || "";
  if (!accept.includes("application/json")) {
    return context.json(
      jsonrpcError(null, -32000, "Not Acceptable: Client must accept application/json"),
      406,
      corsHeaders,
    );
  }

  try {
    const body = await context.req.json() as {
      id: string | number | null;
      method: string;
      params?: { arguments?: Record<string, unknown>; name?: string };
    };

    if (body.method === "initialize") {
      return context.json(
        jsonrpcResponse(body.id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        }),
        200,
        corsHeaders,
      );
    }

    if (body.method === "notifications/initialized") {
      return context.json(jsonrpcResponse(body.id, {}), 200, corsHeaders);
    }

    const authHeader = context.req.header("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return context.json(jsonrpcError(body.id, -32000, "Unauthorized: Bearer token required"), 401, corsHeaders);
    }

    let userId = "";
    try {
      userId = (await requireAuth0User(context.req.raw)).userId;
    } catch {
      return context.json(jsonrpcError(body.id, -32000, "Unauthorized"), 401, corsHeaders);
    }

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: settings } = await supabase
      .from("user_settings")
      .select("mcp_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (!settings?.mcp_enabled) {
      return context.json(
        jsonrpcError(body.id, -32000, "MCP Server is not enabled. Enable it in Tether settings."),
        403,
        corsHeaders,
      );
    }

    const permissions = await getActivePermissions(supabase, userId);
    const tools = permissionsToTools(permissions);

    if (body.method === "tools/list") {
      return context.json(
        jsonrpcResponse(body.id, {
          tools: tools.map(({ _action, _missionId, ...tool }) => tool),
        }),
        200,
        corsHeaders,
      );
    }

    if (body.method === "tools/call") {
      const tool = tools.find((candidate) => candidate.name === body.params?.name);
      if (!tool) {
        return context.json(jsonrpcError(body.id, -32602, `Unknown tool: ${body.params?.name ?? ""}`), 200, corsHeaders);
      }

      const agentActionUrl = `${requireEnv("SUPABASE_URL")}/functions/v1/agent-action`;
      const actionResponse = await fetch(agentActionUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          apikey: requireEnv("SUPABASE_ANON_KEY"),
        },
        body: JSON.stringify({
          mission_id: tool._missionId,
          action: tool._action,
          params: body.params?.arguments ?? {},
        }),
      });

      const actionResult = await actionResponse.json();
      if (actionResponse.ok && actionResult.allowed) {
        return context.json(
          jsonrpcResponse(body.id, {
            content: [{
              type: "text",
              text: JSON.stringify({
                action: tool._action,
                summary: actionResult.summary ?? actionResult.result ?? "Action executed successfully",
              }),
            }],
          }),
          200,
          corsHeaders,
        );
      }

      return context.json(
        jsonrpcResponse(body.id, {
          content: [{ type: "text", text: `Action blocked: ${actionResult.error ?? "Unknown error"}` }],
          isError: true,
        }),
        200,
        corsHeaders,
      );
    }

    return context.json(jsonrpcError(body.id, -32601, `Method not found: ${body.method}`), 200, corsHeaders);
  } catch (error) {
    console.error("MCP server error:", error);
    return context.json(
      jsonrpcError(null, -32603, error instanceof Error ? error.message : "Internal error"),
      500,
      corsHeaders,
    );
  }
});

Deno.serve(app.fetch);
