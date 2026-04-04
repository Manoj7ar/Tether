import { useState } from "react";
import { Play, ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { callEdgeApi } from "@/lib/edge-call";
import { buildDemoMcpResponse } from "@/lib/demo-data";
import { getErrorMessage } from "@/lib/error-utils";

type McpMethod = "initialize" | "tools/list" | "tools/call";
type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: McpMethod;
  params: Record<string, unknown>;
};

const METHODS: { value: McpMethod; label: string; description: string }[] = [
  { value: "initialize", label: "initialize", description: "Handshake with the MCP server" },
  { value: "tools/list", label: "tools/list", description: "List available tools from active missions" },
  { value: "tools/call", label: "tools/call", description: "Execute a tool through enforcement" },
];

export default function McpTestPanel({ endpoint }: { endpoint: string }) {
  const { getAccessToken } = useAuth();
  const demo = useDemoMode();
  const [method, setMethod] = useState<McpMethod>("initialize");
  const [toolName, setToolName] = useState("");
  const [toolParams, setToolParams] = useState("{}");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const sendRequest = async () => {
    setLoading(true);
    setResponse(null);
    setStatusCode(null);

    try {
      if (demo) {
        const data = buildDemoMcpResponse(method);
        setStatusCode(200);
        setResponse(JSON.stringify(data, null, 2));
      } else {
        const body: JsonRpcRequest = { jsonrpc: "2.0", id: 1, method, params: {} };
        if (method === "tools/call") {
          body.params = {
            name: toolName,
            arguments: JSON.parse(toolParams || "{}"),
          };
        }

        const data = await callEdgeApi(getAccessToken, {
          url: endpoint,
          body: body as unknown as Record<string, unknown>,
          includeApiKey: true,
          extraHeaders: { Accept: "application/json" },
        });

        setStatusCode(200);
        setResponse(JSON.stringify(data, null, 2));
      }
    } catch (error: unknown) {
      setResponse(JSON.stringify({ error: getErrorMessage(error) }, null, 2));
      setStatusCode(0);
    } finally {
      setLoading(false);
    }
  };

  const statusColor =
    statusCode === null ? "" :
    statusCode >= 200 && statusCode < 300 ? "text-green-600" :
    statusCode >= 400 ? "text-destructive" : "text-accent";

  return (
    <div className="px-6 py-4 space-y-4 border-t border-border">
      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
        Test Console
      </p>

      {/* Method selector */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Method</label>
        <div className="relative">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as McpMethod)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-mono appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {METHODS.find((m) => m.value === method)?.description}
        </p>
      </div>

      {/* tools/call params */}
      {method === "tools/call" && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Tool Name</label>
            <input
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              placeholder="e.g. github_repos_read"
              className="mt-1 w-full h-8 rounded-md border border-input bg-background px-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Arguments (JSON)</label>
            <textarea
              value={toolParams}
              onChange={(e) => setToolParams(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Send button */}
      <button
        onClick={sendRequest}
        disabled={loading}
        className="btn-glass-ghost px-4 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
        Send Request
      </button>

      {/* Response */}
      {response !== null && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Response</span>
            {statusCode !== null && (
              <span className={`text-xs font-mono font-bold ${statusColor}`}>
                {statusCode}
              </span>
            )}
          </div>
          <pre className="code-surface px-4 py-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all rounded-md">
            {response}
          </pre>
        </div>
      )}
    </div>
  );
}
