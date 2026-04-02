import {
  Check,
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Lock,
  Unlock,
  Eye,
  Pencil,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ArrowDownRight,
  FileText,
  Fingerprint,
  Globe,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface Permission {
  provider: string;
  scope: string;
  actionType: "read" | "write";
}

interface IntentVerification {
  verdict: "passed" | "warning" | "failed";
  reasoning: string;
}

interface ScopeNegotiationChange {
  original_scope: string;
  downgraded_scope: string;
  reason: string;
}

interface ScopeNegotiation {
  negotiated: boolean;
  changes: ScopeNegotiationChange[];
}

interface ManifestData {
  tetherNumber: string;
  createdAt: string;
  expiryLabel: string;
  objective: string;
  permissions: Permission[];
  willDo: string[];
  willNotDo: string[];
  riskLevel: "low" | "medium" | "high";
  irreversibleActions: string[];
  externalDataExposure: "low" | "medium" | "high";
  intentVerification: IntentVerification;
  scopeNegotiation?: ScopeNegotiation;
}

interface Props {
  manifest: ManifestData;
}

const riskConfig = {
  low: {
    border: "border-l-primary",
    badge: "bg-primary/8 text-primary border border-primary/20",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    label: "Low Risk",
  },
  medium: {
    border: "border-l-accent",
    badge: "bg-accent/8 text-accent border border-accent/20",
    icon: <Shield className="h-3.5 w-3.5" />,
    label: "Medium Risk",
  },
  high: {
    border: "border-l-destructive",
    badge: "bg-destructive/8 text-destructive border border-destructive/20",
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
    label: "High Risk",
  },
};

const verdictConfig = {
  passed: {
    icon: <ShieldCheck className="h-4 w-4" />,
    label: "Verified",
    bg: "bg-primary/6 border-primary/15",
    text: "text-primary",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "Caution",
    bg: "bg-accent/6 border-accent/15",
    text: "text-accent",
  },
  failed: {
    icon: <ShieldAlert className="h-4 w-4" />,
    label: "Failed",
    bg: "bg-destructive/6 border-destructive/15",
    text: "text-destructive",
  },
};

const exposureConfig = {
  low: { label: "Minimal", text: "text-primary" },
  medium: { label: "Moderate", text: "text-accent" },
  high: { label: "Significant", text: "text-destructive" },
};

export default function MissionManifestCard({ manifest }: Props) {
  const risk = riskConfig[manifest.riskLevel];
  const verdict = verdictConfig[manifest.intentVerification.verdict];
  const exposure = exposureConfig[manifest.externalDataExposure];
  const [negotiationOpen, setNegotiationOpen] = useState(false);
  const hasNegotiation = manifest.scopeNegotiation?.negotiated && manifest.scopeNegotiation.changes.length > 0;

  return (
    <div className={`rounded-xl border bg-card overflow-hidden border-l-4 ${risk.border}`}>
      {/* ── Header ── */}
      <div className="px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs tracking-wider text-foreground font-semibold">
              TETHER #{manifest.tetherNumber}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground pl-[26px]">
            <span>{manifest.createdAt}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {manifest.expiryLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasNegotiation && (
            <span className="text-[11px] px-2.5 py-1 rounded-md font-medium bg-accent/8 text-accent border border-accent/20 flex items-center gap-1.5">
              <ArrowDownRight className="h-3 w-3" />
              Negotiated
            </span>
          )}
          <span className={`text-[11px] px-2.5 py-1 rounded-md font-medium flex items-center gap-1.5 ${risk.badge}`}>
            {risk.icon}
            {risk.label}
          </span>
        </div>
      </div>

      {/* ── Scope Negotiation (collapsible) ── */}
      {hasNegotiation && (
        <div className="border-t border-border/60">
          <button
            onClick={() => setNegotiationOpen(!negotiationOpen)}
            className="w-full px-5 sm:px-6 py-3 flex items-center gap-2.5 hover:bg-muted/30 transition-colors"
          >
            <ArrowDownRight className="h-3.5 w-3.5 text-accent" />
            <span className="text-xs text-foreground font-medium flex-1 text-left">
              {manifest.scopeNegotiation!.changes.length} scope{manifest.scopeNegotiation!.changes.length > 1 ? "s" : ""} downgraded for least-privilege compliance
            </span>
            {negotiationOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
          {negotiationOpen && (
            <div className="px-5 sm:px-6 pb-4 space-y-2">
              {manifest.scopeNegotiation!.changes.map((change, i) => (
                <div key={i} className="rounded-lg bg-muted/40 px-4 py-2.5 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-muted-foreground line-through">{change.original_scope}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-foreground font-semibold">{change.downgraded_scope}</span>
                  </div>
                  <p className="text-muted-foreground">{change.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Objective ── */}
      <Section label="Objective">
        <p className="text-sm text-foreground leading-relaxed">{manifest.objective}</p>
      </Section>

      {/* ── Authorized Scope ── */}
      <Section label="Authorized Scope">
        <div className="space-y-0">
          {manifest.permissions.map((p, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 py-2.5 border-b border-border/40 last:border-0"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {p.actionType === "write" ? (
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="font-mono text-xs text-foreground truncate">
                  {p.provider}
                  <span className="text-muted-foreground">.{p.scope}</span>
                </span>
              </div>
              <span
                className={`text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${
                  p.actionType === "write"
                    ? "bg-accent/8 text-accent"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {p.actionType}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Actions: Will / Won't ── */}
      <div className="border-t border-border/60 grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
        <div className="px-5 sm:px-6 py-4">
          <SectionLabel>Authorized Actions</SectionLabel>
          <ul className="space-y-2 mt-2.5">
            {manifest.willDo.map((item, i) => (
              <li key={i} className="text-sm text-foreground flex items-start gap-2.5">
                <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 sm:px-6 py-4">
          <SectionLabel>Restricted Actions</SectionLabel>
          <ul className="space-y-2 mt-2.5">
            {manifest.willNotDo.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2.5">
                <X className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Risk Assessment ── */}
      <div className="border-t border-border/60 px-5 sm:px-6 py-4">
        <SectionLabel>Risk Assessment</SectionLabel>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <MetricTile
            icon={<Shield className="h-4 w-4" />}
            label="Overall"
            value={manifest.riskLevel.charAt(0).toUpperCase() + manifest.riskLevel.slice(1)}
            valueClass={
              manifest.riskLevel === "high"
                ? "text-destructive"
                : manifest.riskLevel === "medium"
                ? "text-accent"
                : "text-primary"
            }
          />
          <MetricTile
            icon={<Zap className="h-4 w-4" />}
            label="Irreversible"
            value={String(manifest.irreversibleActions.length)}
            valueClass={manifest.irreversibleActions.length > 0 ? "text-destructive" : "text-primary"}
          />
          <MetricTile
            icon={<Globe className="h-4 w-4" />}
            label="Data Exposure"
            value={exposure.label}
            valueClass={exposure.text}
          />
        </div>
        {manifest.irreversibleActions.length > 0 && (
          <div className="mt-3 rounded-lg bg-destructive/5 border border-destructive/10 px-4 py-2.5">
            <p className="text-[11px] text-destructive font-medium mb-1 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3" />
              Irreversible operations
            </p>
            <p className="text-xs text-muted-foreground">{manifest.irreversibleActions.join(" · ")}</p>
          </div>
        )}
      </div>

      {/* ── Intent Verification ── */}
      <div className={`border-t border-border/60 px-5 sm:px-6 py-4`}>
        <SectionLabel>Intent Verification</SectionLabel>
        <div className={`mt-3 rounded-lg border px-4 py-3 flex items-start gap-3 ${verdict.bg}`}>
          <div className={`mt-0.5 ${verdict.text}`}>{verdict.icon}</div>
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-semibold text-foreground flex items-center gap-2">
              Independent AI Audit
              <span className={`font-mono text-[11px] uppercase ${verdict.text}`}>
                {verdict.label}
              </span>
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {manifest.intentVerification.reasoning}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border/60 px-5 sm:px-6 py-4">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
      {children}
    </p>
  );
}

function MetricTile({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-3 text-center space-y-1.5">
      <div className="flex justify-center text-muted-foreground">{icon}</div>
      <p className={`text-sm font-semibold ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
