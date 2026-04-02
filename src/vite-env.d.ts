/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH0_AUDIENCE?: string;
  readonly VITE_AUTH0_CLIENT_ID?: string;
  readonly VITE_AUTH0_DATABASE_CONNECTION?: string;
  readonly VITE_AUTH0_DOMAIN?: string;
  readonly VITE_AUTH0_SCOPE?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
