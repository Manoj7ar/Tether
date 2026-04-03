-- Display name for sidebar; onboarding gate for first-time users.
-- DEFAULT true on onboarding_completed backfills existing rows so they skip the wizard.
-- New rows from the user-settings Edge function must set onboarding_completed = false explicitly.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_settings.display_name IS 'User-chosen label shown in the app sidebar.';
COMMENT ON COLUMN public.user_settings.onboarding_completed IS 'False until first-time onboarding finishes; new inserts set false in Edge.';
