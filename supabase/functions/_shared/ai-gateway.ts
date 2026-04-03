import { requireEnv } from "./env.ts";

/** OpenAI-compatible `POST .../v1/chat/completions` base (include path through `/v1/chat/completions`). */
export function getAiChatCompletionsUrl(): string {
  return requireEnv("AI_COMPAT_API_URL");
}

export function getAiApiKey(): string {
  return requireEnv("AI_COMPAT_API_KEY");
}
