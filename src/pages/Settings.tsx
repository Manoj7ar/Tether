import { useState } from "react";
import { Settings as SettingsIcon, Copy, Check, Zap, Plus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { toast } from "@/hooks/use-toast";
import McpTestPanel from "@/components/McpTestPanel";
import { getErrorMessage } from "@/lib/error-utils";
import { missionActionRegistry } from "../../shared/mission-actions";

export default function Settings() {
  const { data: settings, isLoading } = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const [copied, setCopied] = useState(false);
  const [newAction, setNewAction] = useState("");

  const mcpEnabled = settings?.mcp_enabled ?? false;
  const ambientEnabled = settings?.ambient_enabled ?? false;
  const ambientBudgetMax = settings?.ambient_budget_max ?? 50;
  const ambientAllowedActions = settings?.ambient_allowed_actions ?? [];
  const ambientActionSuggestions = missionActionRegistry
    .filter((action) => action.actionType === "read")
    .map((action) => action.id);

  const mcpEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-server`;

  const handleToggleMcp = async (enabled: boolean) => {
    try {
      await updateSettings.mutateAsync({ mcp_enabled: enabled });
      toast({ title: enabled ? "MCP Server enabled" : "MCP Server disabled" });
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleToggleAmbient = async (enabled: boolean) => {
    try {
      await updateSettings.mutateAsync({ ambient_enabled: enabled });
      toast({ title: enabled ? "Ambient Mode enabled" : "Ambient Mode disabled" });
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleBudgetChange = async (value: number[]) => {
    try {
      await updateSettings.mutateAsync({ ambient_budget_max: value[0] });
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleAddAction = async () => {
    if (!newAction.trim()) return;
    const updated = [...ambientAllowedActions, newAction.trim()];
    await updateSettings.mutateAsync({ ambient_allowed_actions: updated });
    setNewAction("");
  };

  const handleRemoveAction = async (action: string) => {
    const updated = ambientAllowedActions.filter((a) => a !== action);
    await updateSettings.mutateAsync({ ambient_allowed_actions: updated });
  };

  const copyEndpoint = () => {
    navigator.clipboard.writeText(mcpEndpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return <div className="max-w-2xl mx-auto p-6 lg:p-8"><div className="card-tether p-12 text-center text-sm text-muted-foreground">Loading settings...</div></div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 lg:p-8 space-y-8 animate-card-in">
      <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
        <SettingsIcon className="h-6 w-6" /> Settings
      </h1>

      {/* MCP Server */}
      <div className="card-tether overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">MCP Server Mode</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Turn Tether into an MCP server. Any MCP-compatible agent can connect and have tool calls enforced.
              </p>
            </div>
            <Switch checked={mcpEnabled} onCheckedChange={handleToggleMcp} />
          </div>
        </div>

        {mcpEnabled && (
          <div className="px-6 py-4 space-y-3">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">Endpoint URL</p>
            <div className="flex items-center gap-2">
              <div className="code-surface px-3 py-2 flex-1 text-xs break-all select-all">
                {mcpEndpoint}
              </div>
              <button onClick={copyEndpoint} className="btn-glass-ghost p-2 shrink-0">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Point any MCP-compatible agent (Claude, Cursor, LangChain) at this endpoint with your auth token.
              Every tool call will be scope-checked, policy-checked, and logged through Tether's enforcement engine.
            </p>
            <McpTestPanel endpoint={mcpEndpoint} />
          </div>
        )}
      </div>

      {/* Ambient Agent Mode */}
      <div className="card-tether overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Ambient Agent Mode
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Always-on agent with a standing capability budget for pre-approved low-risk actions.
              </p>
            </div>
            <Switch checked={ambientEnabled} onCheckedChange={handleToggleAmbient} />
          </div>
        </div>

        {ambientEnabled && (
          <div className="px-6 py-4 space-y-5">
            {/* Budget */}
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-2">
                Action Budget (24h rolling window)
              </p>
              <div className="flex items-center gap-4">
                <Slider
                  value={[ambientBudgetMax]}
                  onValueCommit={handleBudgetChange}
                  min={10}
                  max={200}
                  step={10}
                  className="flex-1"
                />
                <span className="font-mono text-sm font-semibold text-foreground w-12 text-right">
                  {ambientBudgetMax}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Actions exceeding this budget will auto-create a mission requiring approval.
              </p>
            </div>

            {/* Allowed Actions */}
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mb-2">
                Pre-Approved Actions
              </p>
              <div className="space-y-2 mb-3">
                {ambientAllowedActions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No actions configured. Add read-only actions below.</p>
                ) : (
                  ambientAllowedActions.map((action) => (
                    <div key={action} className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-xs flex-1">{action}</span>
                      <button onClick={() => handleRemoveAction(action)} className="text-muted-foreground hover:text-destructive p-1">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  placeholder="e.g. github.list_issues"
                  className="h-8 text-xs font-mono flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddAction()}
                />
                <button onClick={handleAddAction} disabled={!newAction.trim()} className="btn-glass-ghost px-3 py-1.5 text-xs flex items-center gap-1 disabled:opacity-40">
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-3">
                {ambientActionSuggestions
                  .filter((action) => !ambientAllowedActions.includes(action))
                  .map((action) => (
                    <button
                      key={action}
                      onClick={() => setNewAction(action)}
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] font-mono text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {action}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
