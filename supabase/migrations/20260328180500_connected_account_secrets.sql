CREATE TABLE IF NOT EXISTS public.connected_account_secrets (
  account_id UUID PRIMARY KEY REFERENCES public.connected_accounts(id) ON DELETE CASCADE,
  auth0_user_id TEXT,
  provider_user_id TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  token_type TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.connected_account_secrets ENABLE ROW LEVEL SECURITY;
