import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, Copy, Check, Zap, Plus, X, Video } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useUserSettings, useUpdateUserSettings, DEFAULT_USER_SETTINGS } from "@/hooks/useUserSettings";
import { toast } from "@/hooks/use-toast";
import McpTestPanel from "@/components/agent/McpTestPanel";
import { getErrorMessage } from "@/lib/error-utils";
import { getEdgeFunctionUrl } from "@/lib/env";
import { missionActionRegistry } from "../../shared/mission-actions";

export default function Settings() {
  const navigate = useNavigate();
  const { data: settings, isLoading, isError, error, refetch, isFetching } = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const [copied, setCopied] = useState(false);
  const [newAction, setNewAction] = useState("");

  const s = settings ?? DEFAULT_USER_SETTINGS;
  const demoMode = s.demo_mode;
  const mcpEnabled = s.mcp_enabled;
  const ambientEnabled = s.ambient_enabled;
  const ambientBudgetMax = s.ambient_budget_max;
  const ambientAllowedActions = s.ambient_allowed_actions;
  const ambientActionSuggestions = missionActionRegistry
    .filter((action) => action.actionType === "read")
    .map((action) => action.id);

  const mcpEndpoint = getEdgeFunctionUrl("mcp-server");

  const handleToggleDemo = async (enabled: boolean) => {
    try {
      await updateSettings.mutateAsync({
        demo_mode: enabled,
        ...(enabled ? { onboarding_completed: true } : {}),
      });
      if (enabled) {
        toast({
          title: "Demo mode on",
          description: "Manifest, policy, nudges, and tool runs use scripted data. OAuth connections stay real.",
        });
        navigate("/dashboard");
      } else {
        toast({ title: "Demo mode off", description: "Restored live AI and provider execution." });
      }
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

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
    try {
      await updateSettings.mutateAsync({ ambient_allowed_actions: updated });
      setNewAction("");
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleRemoveAction = async (action: string) => {
    const updated = ambientAllowedActions.filter((a) => a !== action);
    try {
      await updateSettings.mutateAsync({ ambient_allowed_actions: updated });
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
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
      <p className="text-sm text-muted-foreground -mt-4">
        <a href="#demo-mock-mode" className="text-primary underline underline-offset-2 hover:no-underline">
          Demo / mock mode for recordings
        </a>
      </p>

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load saved settings</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{getErrorMessage(error)}</span>
            <Button type="button" variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
              {isFetching ? "Retrying…" : "Retry"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

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

      {/* Demo / mock mode (recordings) — anchor: #demo-mock-mode */}
      <section
        id="demo-mock-mode"
        className="card-tether overflow-hidden scroll-mt-24 border-2 border-primary/40 ring-2 ring-primary/20 shadow-md"
        aria-labelledby="demo-mock-mode-heading"
      >
        <div className="px-6 py-4 border-b border-border bg-primary/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2
                id="demo-mock-mode-heading"
                className="font-semibold text-foreground flex items-center gap-2 text-base"
              >
                <Video className="h-5 w-5 text-primary shrink-0" aria-hidden />
                Demo / mock mode
              </h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                For screen recordings: mission manifest, policy AI, dashboard nudges, and agent/MCP tool execution return
                fixed scripted content and do not call live provider APIs. Auth0 sign-in and connecting GitHub/Gmail in
                Connected Accounts stay real. Mission approval, policy blocks, and scope checks behave normally.
              </p>
            </div>
            <Switch checked={demoMode} onCheckedChange={handleToggleDemo} aria-label="Toggle demo or mock mode" />
          </div>
        </div>
        {demoMode && (
          <div className="px-6 py-3 bg-accent/10 text-xs text-muted-foreground border-t border-border">
            A banner appears on every page while demo mode is on. Turn it off when you are done recording.
          </div>
        )}
      </section>
    </div>
  );
}
