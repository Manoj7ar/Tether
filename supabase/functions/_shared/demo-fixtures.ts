/**
 * Deterministic payloads for demo_mode (recordings). Shapes match production Edge responses.
 */

export function buildDemoManifest(task: string, timeLimitMins: number) {
  const now = new Date();
  const createdAt = now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return {
    tetherNumber: "042",
    createdAt,
    expiryLabel: `${timeLimitMins} minutes from approval`,
    objective: task,
    permissions: [
      { provider: "GitHub", scope: "issues:read", actionType: "read" as const },
      { provider: "Gmail", scope: "gmail.readonly", actionType: "read" as const },
      { provider: "Gmail", scope: "gmail.send", actionType: "write" as const },
    ],
    willDo: [
      "List open GitHub issues assigned to you and summarize blockers.",
      "Draft a concise standup email from your notes (demo script).",
    ],
    willNotDo: [
      "Delete repositories or modify protected branches.",
      "Send email outside approved domains during this mission.",
    ],
    riskLevel: "medium" as const,
    irreversibleActions: ["Sending email to external recipients"],
    externalDataExposure: "medium" as const,
    intentVerification: {
      verdict: "passed" as const,
      reasoning:
        "Demo mode: auditor verdict is scripted. Requested scopes align with triage + standup summary; write scope limited to outbound email only.",
    },
    scopeNegotiation: {
      negotiated: true,
      changes: [
        {
          original_scope: "repo (full admin)",
          downgraded_scope: "issues:read",
          reason: "Least privilege for triage-only workflow (demo).",
        },
      ],
    },
  };
}

export function buildDemoPolicyResponse(descriptionSnippet: string) {
  const snippet = descriptionSnippet.trim().slice(0, 120);
  return {
    explanation: snippet
      ? `Demo mode: scripted rules for “${snippet}${descriptionSnippet.length > 120 ? "…" : ""}”.`
      : "Demo mode: sample policy rules for recording.",
    rules: [
      {
        action: "gmail.send_email",
        enabled: true,
        conditions: {
          block_external: true,
          allowed_domains: ["company.com", "yourorg.test"],
          reason: "Demo: block external sends unless domain allowlisted",
        },
      },
      {
        action: "github.delete_repo",
        enabled: true,
        conditions: {
          allowed: false,
          reason: "Demo: destructive repo operations always blocked",
        },
      },
    ],
  };
}

export function buildDemoNudges() {
  return {
    nudges: [
      {
        type: "suggestion" as const,
        title: "Tighten Gmail send scope",
        body:
          "Demo mode: you often approve gmail.send with broad tasks. Consider missions that only request gmail.readonly until send is needed.",
      },
      {
        type: "warning" as const,
        title: "High-risk actions in active missions",
        body:
          "Demo mode: github.delete_repo appears in your manifest templates. Step-up verification would gate these in production.",
      },
      {
        type: "optimization" as const,
        title: "Shorter mission windows",
        body:
          "Demo mode: 30-minute limits reduce blast radius. Try 15 minutes for read-only triage missions.",
      },
    ],
    cached: false,
  };
}

export function demoExecutionPayload(actionId: string): {
  result: Record<string, unknown>;
  summary: string;
} {
  return {
    result: {
      demo: true,
      action: actionId,
      preview: "No live provider API call was made (demo mode).",
    },
    summary: "Demo mode: action approved by Tether — provider response simulated for recording.",
  };
}
