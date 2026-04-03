import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * Supabase `functions.invoke` returns a generic message when the Edge Function responds with a non-2xx body.
 * The function often includes `{ error: "..." }` JSON — parse it for user-visible messages.
 */
export async function edgeFunctionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      const cloned = error.context.clone();
      const ct = (cloned.headers.get("Content-Type") ?? "").split(";")[0].trim();
      if (ct === "application/json") {
        const body = (await cloned.json()) as { error?: unknown };
        if (typeof body.error === "string" && body.error.trim()) {
          return body.error;
        }
      } else {
        const text = (await cloned.text()).trim();
        if (text) return text.slice(0, 500);
      }
    } catch {
      // fall through
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong";
}
