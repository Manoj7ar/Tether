function required(name: string): string {
  const value = import.meta.env[name];

  if (!value || typeof value !== "string") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optional(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export interface AppConfig {
  auth0Audience?: string;
  auth0ClientId: string;
  auth0DatabaseConnection?: string;
  auth0Domain: string;
  auth0Scope?: string;
  supabaseProjectId?: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
}

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    auth0Audience: optional("VITE_AUTH0_AUDIENCE"),
    auth0ClientId: required("VITE_AUTH0_CLIENT_ID"),
    auth0DatabaseConnection: optional("VITE_AUTH0_DATABASE_CONNECTION"),
    auth0Domain: required("VITE_AUTH0_DOMAIN"),
    auth0Scope: optional("VITE_AUTH0_SCOPE"),
    supabaseProjectId: optional("VITE_SUPABASE_PROJECT_ID"),
    supabasePublishableKey: required("VITE_SUPABASE_PUBLISHABLE_KEY"),
    supabaseUrl: required("VITE_SUPABASE_URL"),
  };

  return cachedConfig;
}

/** Edge Functions must use the same project as `VITE_SUPABASE_URL` (avoid mixing with a wrong `VITE_SUPABASE_PROJECT_ID`). */
export function getSupabaseFunctionsBaseUrl(): string {
  const base = getAppConfig().supabaseUrl.replace(/\/$/, "");
  return `${base}/functions/v1`;
}
