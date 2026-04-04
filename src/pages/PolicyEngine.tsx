import { useState, useEffect } from "react";
import { Shield, Plus, Trash2, Power, PowerOff, Save, RotateCcw, ChevronDown, ChevronUp, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { usePolicyRules, useSavePolicyRules, type PolicyRule } from "@/hooks/usePolicyRules";
import { useExecutionLog } from "@/hooks/useMissions";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { callEdgeFn } from "@/lib/edge-call";
import { DEMO_POLICY_RESPONSE } from "@/lib/demo-data";
import { getErrorMessage } from "@/lib/error-utils";

interface GeneratedPolicyRule {
  action: string;
  conditions: Record<string, unknown>;
  enabled?: boolean;
}

interface GeneratedPolicyResponse {
  explanation: string;
  rules: GeneratedPolicyRule[];
}

const RULE_TEMPLATES: { label: string; rule: Omit<PolicyRule, "id"> }[] = [
  {
    label: "Block external emails",
    rule: {
      action: "gmail.send_email",
      enabled: true,
      conditions: { allowed_domains: ["company.com"], block_external: true },
    },
  },
  {
    label: "Block repo deletion",
    rule: {
      action: "github.delete_repo",
      enabled: true,
      conditions: { allowed: false, reason: "Destructive operations require human execution" },
    },
  },
  {
    label: "Restrict push to staging only",
    rule: {
      action: "github.push_code",
      enabled: true,
      conditions: { allowed_repos: ["acme/staging"], blocked_repos: ["acme/production"] },
    },
  },
  {
    label: "Block calendar event deletion",
    rule: {
      action: "calendar.delete_event",
      enabled: true,
      conditions: { allowed: false },
    },
  },
];

function generateId() {
  return crypto.randomUUID();
}

function ConditionEditor({
  conditions,
  onChange,
}: {
  conditions: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const [newKey, setNewKey] = useState("");

  const updateValue = (key: string, raw: string) => {
    let parsed: unknown = raw;
    if (raw === "true") parsed = true;
    else if (raw === "false") parsed = false;
    else if (!isNaN(Number(raw)) && raw.trim() !== "") parsed = Number(raw);
    else {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }
    }
    onChange({ ...conditions, [key]: parsed });
  };

  const removeKey = (key: string) => {
    const next = { ...conditions };
    delete next[key];
    onChange(next);
  };

  const addKey = () => {
    if (!newKey.trim()) return;
    onChange({ ...conditions, [newKey.trim()]: "" });
    setNewKey("");
  };

  return (
    <div className="space-y-2">
      {Object.entries(conditions).map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground w-24 sm:w-36 shrink-0 truncate" title={key}>
            {key}
          </span>
          <Input
            value={typeof val === "object" ? JSON.stringify(val) : String(val)}
            onChange={(e) => updateValue(key, e.target.value)}
            className="h-8 text-xs font-mono flex-1 min-w-0"
          />
          <button
            onClick={() => removeKey(key)}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-1">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="new_condition_key"
          className="h-8 text-xs font-mono w-36 shrink-0"
          onKeyDown={(e) => e.key === "Enter" && addKey()}
        />
        <button
          onClick={addKey}
          disabled={!newKey.trim()}
          className="text-xs text-primary hover:underline disabled:opacity-40"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  onUpdate,
  onDelete,
}: {
  rule: PolicyRule;
  onUpdate: (r: PolicyRule) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`card-tether overflow-hidden transition-all ${
        rule.enabled ? "" : "opacity-60"
      }`}
    >
      <div className="px-5 py-4 flex items-center gap-3">
        <Switch
          checked={rule.enabled}
          onCheckedChange={(enabled) => onUpdate({ ...rule, enabled })}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <Input
            value={rule.action}
            onChange={(e) => onUpdate({ ...rule, action: e.target.value })}
            className="h-8 font-mono text-sm border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="provider.action"
          />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 pt-0 border-t border-border">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3 mt-3">
            Conditions
          </p>
          <ConditionEditor
            conditions={rule.conditions}
            onChange={(conditions) => onUpdate({ ...rule, conditions })}
          />
        </div>
      )}
    </div>
  );
}

export default function PolicyEngine() {
  const { getAccessToken } = useAuth();
  const demo = useDemoMode();
  const { data, isLoading } = usePolicyRules();
  const saveMutation = useSavePolicyRules();
  const { data: logs } = useExecutionLog();

  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // NL Policy Editor state
  const [nlInput, setNlInput] = useState("");
  const [nlGenerating, setNlGenerating] = useState(false);
  const [nlResult, setNlResult] = useState<GeneratedPolicyResponse | null>(null);

  // Sync from server
  useEffect(() => {
    if (data) {
      setRules(data.rules);
      setHasChanges(false);
    }
  }, [data]);

  const violations = (logs || []).filter((l) => l.status === "blocked");

  const updateRule = (index: number, updated: PolicyRule) => {
    const next = [...rules];
    next[index] = updated;
    setRules(next);
    setHasChanges(true);
  };

  const deleteRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const addRule = (template?: Omit<PolicyRule, "id">) => {
    const newRule: PolicyRule = template
      ? { ...template, id: generateId() }
      : { id: generateId(), action: "", enabled: true, conditions: {} };
    setRules([...rules, newRule]);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({ existingId: data?.id ?? null, rules });
      toast({ title: "Policy saved", description: `${rules.length} rule(s) saved successfully.` });
    } catch (error: unknown) {
      toast({ title: "Error saving policy", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleReset = () => {
    if (data) {
      setRules(data.rules);
      setHasChanges(false);
    }
  };

  const handleNlGenerate = async () => {
    if (!nlInput.trim()) return;
    setNlGenerating(true);
    setNlResult(null);
    try {
      if (demo) {
        setNlResult({ explanation: DEMO_POLICY_RESPONSE.reasoning, rules: DEMO_POLICY_RESPONSE.rules });
      } else {
        const result = await callEdgeFn(getAccessToken, {
          functionName: "generate-policy",
          body: { description: nlInput },
        });
        setNlResult(result as GeneratedPolicyResponse);
      }
    } catch (error: unknown) {
      toast({ title: "Failed to generate policy", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setNlGenerating(false);
    }
  };

  const handleAddNlRules = () => {
    if (!nlResult?.rules) return;
    const newRules = nlResult.rules.map((rule) => ({
      id: generateId(),
      action: rule.action,
      enabled: rule.enabled ?? true,
      conditions: rule.conditions || {},
    }));
    setRules([...rules, ...newRules]);
    setHasChanges(true);
    setNlResult(null);
    setNlInput("");
    toast({ title: "Rules added", description: `${newRules.length} AI-generated rule(s) added.` });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-card-in">
      <h1 className="font-display text-2xl font-bold text-foreground">Policy Engine</h1>

      {/* Explanation */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground leading-relaxed">
          Policy rules apply permanently across all missions. Even if a mission manifest requests a
          permission and you approve it, policy violations are still blocked at execution time.
        </p>
      </div>

      {/* Natural Language Policy Editor */}
      <div className="card-tether overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Natural Language Policy Editor</h2>
          </div>
          <p className="text-xs text-muted-foreground">Describe your policy in plain English and AI will generate the structured rules.</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <Textarea
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            placeholder='e.g. "Never send emails to anyone outside my company", "Only read GitHub repos, never write", "Block all destructive operations"'
            className="min-h-[80px] resize-none text-sm"
          />
          <button
            onClick={handleNlGenerate}
            disabled={!nlInput.trim() || nlGenerating}
            className="btn-glass-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {nlGenerating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="h-4 w-4" /> Generate Policy</>}
          </button>

          {nlResult && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">{nlResult.explanation}</p>
              <div className="code-surface p-3 text-xs overflow-auto max-h-48">
                <pre>{JSON.stringify(nlResult.rules, null, 2)}</pre>
              </div>
              <button
                onClick={handleAddNlRules}
                className="btn-glass-primary px-4 py-2 text-sm"
              >
                + Add {nlResult.rules.length} Rule(s) to Policy
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Rules */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, i) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onUpdate={(r) => updateRule(i, r)}
              onDelete={() => deleteRule(i)}
            />
          ))}

          {rules.length === 0 && (
            <div className="card-tether px-6 py-10 text-center">
              <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No policy rules yet. Add one below or start from a template.</p>
            </div>
          )}
        </div>
      )}

      {/* Add buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => addRule()}
          className="btn-glass-ghost px-4 py-2 text-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Blank Rule
        </button>
        {RULE_TEMPLATES.map((t) => (
          <button
            key={t.label}
            onClick={() => addRule(t.rule)}
            className="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            + {t.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="btn-glass-primary px-6 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Policy"}
        </button>
        <button
          onClick={handleReset}
          disabled={!hasChanges}
          className="btn-glass-ghost px-6 py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
      </div>

      {/* Violations Log */}
      <div>
        <h2 className="font-medium text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Policy Violations Log
          {violations.length > 0 && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
              {violations.length}
            </span>
          )}
        </h2>
        <div className="card-tether overflow-hidden">
          {violations.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-muted-foreground">
              No policy violations recorded yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Time</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Action</th>
                  <th className="px-4 py-2.5 text-xs text-muted-foreground font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v) => (
                  <tr key={v.id} className="border-b border-border last:border-0 bg-destructive/5">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">{v.action}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{v.block_reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
