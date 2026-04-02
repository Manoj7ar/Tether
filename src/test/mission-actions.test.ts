import { describe, expect, it } from "vitest";
import {
  actionRequiresStepUp,
  getCapableActionIdsFromPermissions,
  getMissionAction,
  hasRequiredScope,
  missionRequiresStepUpApproval,
  normalizeActionId,
  normalizeScope,
  validateActionParams,
} from "../../shared/mission-actions";

describe("mission action registry", () => {
  it("normalizes known aliases to canonical action ids", () => {
    expect(normalizeActionId("github.create_issue_comment")).toBe("github.comment_issue");
    expect(normalizeActionId("gmail.send_email")).toBe("gmail.send_email");
  });

  it("normalizes scopes consistently", () => {
    expect(normalizeScope("issues:read")).toBe("github_issues_read");
    expect(normalizeScope("calendar.events.read")).toBe("calendar_events_read");
    expect(normalizeScope("https://www.googleapis.com/auth/gmail.readonly")).toBe("gmail_read");
  });

  it("finds registered actions", () => {
    const action = getMissionAction("github.list_issues");
    expect(action?.provider).toBe("GitHub");
    expect(action?.requiredScopes).toContain("issues:read");
  });

  it("accepts equivalent granted scopes", () => {
    const action = getMissionAction("github.list_issues");
    expect(action).toBeDefined();
    expect(hasRequiredScope(action!, ["repo", "issues:read"])).toBe(true);
    expect(hasRequiredScope(action!, ["issues_read"])).toBe(true);
  });

  it("rejects missing required scopes", () => {
    const action = getMissionAction("gmail.send_email");
    expect(action).toBeDefined();
    expect(hasRequiredScope(action!, ["gmail.readonly"])).toBe(false);
  });

  it("accepts provider URL scopes", () => {
    const action = getMissionAction("gmail.send_email");
    expect(action).toBeDefined();
    expect(hasRequiredScope(action!, ["https://www.googleapis.com/auth/gmail.send"])).toBe(true);
  });

  it("validates params against the registry schema", () => {
    const action = getMissionAction("calendar.create_event");
    expect(action).toBeDefined();

    const valid = validateActionParams(action!, {
      calendar_id: "primary",
      summary: "Team Sync",
      start: "2026-03-29T10:00:00Z",
      end: "2026-03-29T10:30:00Z",
    });
    expect(valid.valid).toBe(true);

    const invalid = validateActionParams(action!, {
      summary: 123,
    });
    expect(invalid.valid).toBe(false);
  });

  it("requires mandatory params", () => {
    const action = getMissionAction("slack.post_message");
    expect(action).toBeDefined();
    const validation = validateActionParams(action!, { channel: "" });
    expect(validation.valid).toBe(false);
  });

  it("flags high-stakes actions for step-up", () => {
    expect(actionRequiresStepUp("github.delete_repo")).toBe(true);
    expect(actionRequiresStepUp("gmail.download_all")).toBe(true);
    expect(actionRequiresStepUp("github.list_issues")).toBe(false);
  });

  it("detects missions that need step-up from granted permissions", () => {
    const perms = [
      { provider: "GitHub", scope: "delete_repo" },
      { provider: "Gmail", scope: "https://www.googleapis.com/auth/gmail.readonly" },
    ];
    const ids = getCapableActionIdsFromPermissions(perms);
    expect(ids).toContain("github.delete_repo");
    expect(missionRequiresStepUpApproval(ids)).toBe(true);

    const lowRisk = getCapableActionIdsFromPermissions([
      { provider: "GitHub", scope: "repo" },
    ]);
    expect(lowRisk).toContain("github.list_issues");
    expect(missionRequiresStepUpApproval(lowRisk)).toBe(false);
  });
});
