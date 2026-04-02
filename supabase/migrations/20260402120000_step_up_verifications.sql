-- Step-up verification after Auth0 re-authentication (OAuth round-trip) for high-stakes actions.
-- Edge functions upsert rows; RLS enabled with no policies (service role only).

CREATE TABLE IF NOT EXISTS public.step_up_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  mission_id UUID NOT NULL REFERENCES public.missions (id) ON DELETE CASCADE,
  github_verified_at TIMESTAMP WITH TIME ZONE,
  google_verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT step_up_verifications_user_mission_key UNIQUE (user_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_step_up_mission ON public.step_up_verifications (mission_id);

ALTER TABLE public.step_up_verifications ENABLE ROW LEVEL SECURITY;
