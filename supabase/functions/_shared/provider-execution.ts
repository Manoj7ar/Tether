import {
  type MissionActionDefinition,
  type ProviderSlug,
  getMissionAction,
} from "../../../shared/mission-actions.ts";

export interface StoredProviderAccount {
  id: string;
  provider: string;
  provider_slug: ProviderSlug;
  provider_username: string | null;
  scopes: string[] | null;
  token_type: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
}

export interface ProviderExecutionResult {
  resultSummary: string;
  result: unknown;
}

function requireString(params: Record<string, unknown>, key: string): string {
  const value = params[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing or invalid "${key}" parameter`);
  }
  return value;
}

function requireNumber(params: Record<string, unknown>, key: string): number {
  const value = params[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Missing or invalid "${key}" parameter`);
  }
  return value;
}

async function providerFetch(
  url: string,
  init: RequestInit,
  provider: string,
): Promise<unknown> {
  const response = await fetch(url, init);
  const text = await response.text();
  let parsed: unknown = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const message =
      (parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string" && parsed.message) ||
      `${provider} request failed with ${response.status}`;
    throw new Error(message);
  }

  if (parsed && typeof parsed === "object" && "ok" in parsed && parsed.ok === false) {
    const message =
      ("error" in parsed && typeof parsed.error === "string" && parsed.error) ||
      `${provider} reported an execution error`;
    throw new Error(message);
  }

  return parsed;
}

function buildGmailMessage(params: Record<string, unknown>): string {
  const to = requireString(params, "to");
  const subject = requireString(params, "subject");
  const body = requireString(params, "body");
  const lines = [
    `To: ${to}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    body,
  ];
  const raw = lines.join("\r\n");
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function redactedPreview(result: unknown): unknown {
  if (Array.isArray(result)) {
    return result.slice(0, 10);
  }

  if (result && typeof result === "object") {
    const entries = Object.entries(result as Record<string, unknown>).slice(0, 12);
    return Object.fromEntries(entries);
  }

  return result;
}

export async function executeProviderAction(
  definition: MissionActionDefinition,
  params: Record<string, unknown>,
  accessToken: string,
): Promise<ProviderExecutionResult> {
  switch (definition.id) {
    case "github.list_issues": {
      const repo = requireString(params, "repo");
      const state = typeof params.state === "string" ? params.state : "open";
      const result = await providerFetch(
        `https://api.github.com/repos/${repo}/issues?state=${encodeURIComponent(state)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "tether-mission-control",
          },
        },
        "GitHub",
      );
      const issues = Array.isArray(result) ? result : [];
      return {
        resultSummary: `Fetched ${issues.length} GitHub issue(s)`,
        result: redactedPreview(issues),
      };
    }

    case "github.create_issue": {
      const repo = requireString(params, "repo");
      const title = requireString(params, "title");
      const body = requireString(params, "body");
      const result = await providerFetch(
        `https://api.github.com/repos/${repo}/issues`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "tether-mission-control",
          },
          body: JSON.stringify({ title, body }),
        },
        "GitHub",
      );
      const payload = result as Record<string, unknown>;
      return {
        resultSummary: `Created GitHub issue #${payload.number ?? "?"}`,
        result: redactedPreview(payload),
      };
    }

    case "github.comment_issue": {
      const repo = requireString(params, "repo");
      const issueNumber = requireNumber(params, "issue_number");
      const body = requireString(params, "body");
      const result = await providerFetch(
        `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "tether-mission-control",
          },
          body: JSON.stringify({ body }),
        },
        "GitHub",
      );
      return {
        resultSummary: `Commented on GitHub issue #${issueNumber}`,
        result: redactedPreview(result),
      };
    }

    case "github.delete_repo": {
      const repo = requireString(params, "repo");
      const ghHeaders = {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "tether-mission-control",
      };
      const delRes = await fetch(`https://api.github.com/repos/${repo}`, {
        method: "DELETE",
        headers: ghHeaders,
      });
      if (!delRes.ok) {
        const text = await delRes.text();
        let parsed: unknown = null;
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = text;
          }
        }
        const message =
          (parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string" && parsed.message) ||
          `GitHub request failed with ${delRes.status}`;
        throw new Error(message);
      }
      return {
        resultSummary: `Deleted GitHub repository ${repo}`,
        result: { deleted: true, repo },
      };
    }

    case "gmail.list_messages": {
      const query = typeof params.query === "string" ? params.query : "";
      const maxResults = typeof params.max_results === "number" ? params.max_results : 10;
      const search = new URLSearchParams({
        q: query,
        maxResults: String(maxResults),
      });
      const result = await providerFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${search.toString()}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        "Gmail",
      );
      const payload = result as { messages?: unknown[] };
      return {
        resultSummary: `Fetched ${payload.messages?.length ?? 0} Gmail message(s)`,
        result: redactedPreview(payload),
      };
    }

    case "gmail.read_message": {
      const messageId = requireString(params, "message_id");
      const result = await providerFetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        "Gmail",
      );
      return {
        resultSummary: `Read Gmail message ${messageId}`,
        result: redactedPreview(result),
      };
    }

    case "gmail.send_email": {
      const raw = buildGmailMessage(params);
      const result = await providerFetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        },
        "Gmail",
      );
      return {
        resultSummary: `Sent email to ${requireString(params, "to")}`,
        result: redactedPreview(result),
      };
    }

    case "gmail.download_all": {
      const rawMax = Deno.env.get("GMAIL_EXPORT_MAX_MESSAGES")?.trim();
      const parsedMax = rawMax ? parseInt(rawMax, 10) : NaN;
      const maxMessages = Number.isFinite(parsedMax)
        ? Math.min(500, Math.max(1, parsedMax))
        : 150;
      const collected: Array<{ id: string; threadId?: string }> = [];
      let pageToken: string | undefined;

      while (collected.length < maxMessages) {
        const pageSize = Math.min(50, maxMessages - collected.length);
        const search = new URLSearchParams({ maxResults: String(pageSize) });
        if (pageToken) search.set("pageToken", pageToken);

        const page = await providerFetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?${search.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
          "Gmail",
        ) as { messages?: Array<{ id: string; threadId?: string }>; nextPageToken?: string };

        const batch = page.messages ?? [];
        for (const m of batch) {
          if (collected.length >= maxMessages) break;
          collected.push({ id: m.id, threadId: m.threadId });
        }

        pageToken = page.nextPageToken;
        if (!pageToken || batch.length === 0) break;
      }

      return {
        resultSummary: `Listed ${collected.length} Gmail message reference(s) (export cap ${maxMessages})`,
        result: {
          total: collected.length,
          cap: maxMessages,
          preview: redactedPreview(collected),
        },
      };
    }

    case "calendar.list_events": {
      const calendarId = typeof params.calendar_id === "string" ? params.calendar_id : "primary";
      const search = new URLSearchParams();
      if (typeof params.time_min === "string") search.set("timeMin", params.time_min);
      if (typeof params.time_max === "string") search.set("timeMax", params.time_max);
      search.set("singleEvents", "true");
      search.set("orderBy", "startTime");

      const result = await providerFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${search.toString()}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        "Google Calendar",
      );
      const payload = result as { items?: unknown[] };
      return {
        resultSummary: `Fetched ${payload.items?.length ?? 0} calendar event(s)`,
        result: redactedPreview(payload),
      };
    }

    case "calendar.create_event": {
      const calendarId = typeof params.calendar_id === "string" ? params.calendar_id : "primary";
      const result = await providerFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: requireString(params, "summary"),
            description: typeof params.description === "string" ? params.description : "",
            start: { dateTime: requireString(params, "start") },
            end: { dateTime: requireString(params, "end") },
          }),
        },
        "Google Calendar",
      );
      return {
        resultSummary: `Created calendar event "${requireString(params, "summary")}"`,
        result: redactedPreview(result),
      };
    }

    case "calendar.update_event": {
      const calendarId = typeof params.calendar_id === "string" ? params.calendar_id : "primary";
      const eventId = requireString(params, "event_id");
      const result = await providerFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            summary: typeof params.summary === "string" ? params.summary : undefined,
            description: typeof params.description === "string" ? params.description : undefined,
            start: typeof params.start === "string" ? { dateTime: params.start } : undefined,
            end: typeof params.end === "string" ? { dateTime: params.end } : undefined,
          }),
        },
        "Google Calendar",
      );
      return {
        resultSummary: `Updated calendar event ${eventId}`,
        result: redactedPreview(result),
      };
    }

    case "slack.list_channels": {
      const result = await providerFetch(
        "https://slack.com/api/conversations.list?exclude_archived=true&limit=100",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        "Slack",
      );
      const payload = result as { channels?: unknown[] };
      return {
        resultSummary: `Fetched ${payload.channels?.length ?? 0} Slack channel(s)`,
        result: redactedPreview(payload),
      };
    }

    case "slack.read_history": {
      const channel = requireString(params, "channel");
      const limit = typeof params.limit === "number" ? params.limit : 20;
      const result = await providerFetch(
        `https://slack.com/api/conversations.history?channel=${encodeURIComponent(channel)}&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
        "Slack",
      );
      return {
        resultSummary: `Fetched Slack history for ${channel}`,
        result: redactedPreview(result),
      };
    }

    case "slack.post_message": {
      const channel = requireString(params, "channel");
      const text = requireString(params, "text");
      const result = await providerFetch(
        "https://slack.com/api/chat.postMessage",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify({ channel, text }),
        },
        "Slack",
      );
      return {
        resultSummary: `Posted Slack message to ${channel}`,
        result: redactedPreview(result),
      };
    }

    default:
      throw new Error(`Action ${definition.id} is not implemented`);
  }
}

export function getActionDefinitionOrThrow(actionId: string): MissionActionDefinition {
  const definition = getMissionAction(actionId);
  if (!definition) {
    throw new Error(`Unknown action: ${actionId}`);
  }
  return definition;
}
