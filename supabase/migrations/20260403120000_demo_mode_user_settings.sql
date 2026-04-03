-- Demo mode: scripted AI + mock provider execution for recordings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS demo_mode boolean NOT NULL DEFAULT false;
