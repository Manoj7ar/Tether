import type { GetTokenSilentlyOptions } from "@auth0/auth0-spa-js";
import { supabase } from "@/integrations/supabase/client";
import { getAppConfig } from "@/lib/env";
import { edgeFunctionErrorMessage } from "@/lib/supabase-functions";

type GetAccessTokenFn = (options?: GetTokenSilentlyOptions) => Promise<string>;

const TOKEN_TIMEOUT_MS = 15_000;
const REQUEST_TIMEOUT_MS = 25_000;

export class EdgeCallError extends Error {
  isAuthError: boolean;
  status?: number;
  constructor(message: string, opts?: { isAuthError?: boolean; status?: number }) {
    super(message);
    this.name = "EdgeCallError";
    this.isAuthError = opts?.isAuthError ?? false;
    this.status = opts?.status;
  }
}

function isLoginRequiredErr(err: unknown): boolean {
  return err instanceof Error && /login.required|login_required|consent.required/i.test(err.message);
}

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  let tid: ReturnType<typeof setTimeout>;
  const tp = new Promise<never>((_, rej) => { tid = setTimeout(() => rej(new Error(msg)), ms); });
  return Promise.race([promise, tp]).finally(() => clearTimeout(tid!));
}

async function acquireToken(getAccessToken: GetAccessTokenFn): Promise<string> {
  try {
    return await withTimeout(getAccessToken(), TOKEN_TIMEOUT_MS, "Session expired — try signing out and back in.");
  } catch (err) {
    if (isLoginRequiredErr(err)) {
      return await withTimeout(getAccessToken({ cacheMode: "off" }), TOKEN_TIMEOUT_MS, "Session expired — try signing out and back in.");
    }
    throw err;
  }
}

async function freshToken(getAccessToken: GetAccessTokenFn): Promise<string> {
  return withTimeout(getAccessToken({ cacheMode: "off" }), TOKEN_TIMEOUT_MS, "Session expired — try signing out and back in.");
}

// ── supabase.functions.invoke transport ─────────────────────────────────

interface InvokeOpts {
  functionName: string;
  method?: "GET" | "POST";
  body?: unknown;
  timeout?: number;
}

async function invokeWithToken(token: string, opts: InvokeOpts) {
  const { data, error } = await supabase.functions.invoke(opts.functionName, {
    method: opts.method ?? "POST",
    headers: { Authorization: `Bearer ${token}` },
    ...(opts.body !== undefined ? { body: opts.body } : {}),
    timeout: opts.timeout ?? REQUEST_TIMEOUT_MS,
  });
  return { data, error };
}

// ── raw fetch transport ─────────────────────────────────────────────────

interface FetchOpts {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  extraHeaders?: Record<string, string>;
  includeApiKey?: boolean;
}

async function fetchWithToken(token: string, opts: FetchOpts) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...opts.extraHeaders,
  };
  if (opts.includeApiKey) {
    headers.apikey = getAppConfig().supabasePublishableKey;
  }
  const res = await fetch(opts.url, {
    method: opts.method ?? "POST",
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, ok: res.ok };
}

function isAuthErrorMsg(msg: string): boolean {
  return /unauthorized|invalid.*session|failed to send/i.test(msg);
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Call a Supabase Edge Function via `supabase.functions.invoke`, with
 * automatic token acquisition, 401 retry, and typed errors.
 */
export async function callEdgeFn(
  getAccessToken: GetAccessTokenFn,
  opts: InvokeOpts,
): Promise<unknown> {
  let token = await acquireToken(getAccessToken);
  let { data, error } = await invokeWithToken(token, opts);

  if (error) {
    const msg = await edgeFunctionErrorMessage(error);
    if (isAuthErrorMsg(msg)) {
      token = await freshToken(getAccessToken);
      ({ data, error } = await invokeWithToken(token, opts));
    }
    if (error) {
      const finalMsg = await edgeFunctionErrorMessage(error);
      throw new EdgeCallError(finalMsg, { isAuthError: isAuthErrorMsg(finalMsg) });
    }
  }
  if (data && typeof data === "object" && "error" in data) {
    const payload = data as { error?: string };
    if (payload.error) throw new EdgeCallError(payload.error);
  }
  return data;
}

/**
 * Call a Supabase Edge Function via raw `fetch` (for endpoints like
 * `missions-api` that return `{ data, error }` JSON), with automatic
 * token acquisition, 401 retry, and typed errors.
 */
export async function callEdgeApi(
  getAccessToken: GetAccessTokenFn,
  opts: FetchOpts & { body?: Record<string, unknown> },
): Promise<unknown> {
  let token = await acquireToken(getAccessToken);
  let { status, json, ok } = await fetchWithToken(token, opts);

  if (status === 401) {
    token = await freshToken(getAccessToken);
    ({ status, json, ok } = await fetchWithToken(token, opts));
  }

  if (!json) throw new EdgeCallError("Empty response from server");
  if (!ok || status >= 400) {
    const msg = (json as { error?: string })?.error || `Server error (${status})`;
    throw new EdgeCallError(msg, { isAuthError: status === 401, status });
  }
  if ((json as { error?: string })?.error) {
    throw new EdgeCallError((json as { error: string }).error);
  }
  return (json as { data?: unknown })?.data ?? json;
}
