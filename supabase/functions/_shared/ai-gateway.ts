import { requireEnv } from "./env.ts";

/** OpenAI-compatible `POST .../v1/chat/completions` base (include path through `/v1/chat/completions`). */
export function getAiChatCompletionsUrl(): string {
  return requireEnv("AI_COMPAT_API_URL");
}

export function getAiApiKey(): string {
  return requireEnv("AI_COMPAT_API_KEY");
}

/**
 * Model id for the chat completions API (provider-specific).
 * Example: `gpt-4o-mini` (OpenAI), `google/gemini-2.0-flash-001` (OpenRouter).
 */
export function getAiCompatModel(): string {
  const fromEnv = Deno.env.get("AI_COMPAT_MODEL")?.trim();
  if (fromEnv) return fromEnv;
  return "gpt-4o-mini";
}
