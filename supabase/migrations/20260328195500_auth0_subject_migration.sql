CREATE OR REPLACE FUNCTION public.requesting_sub()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    CASE
      WHEN NULLIF(current_setting('request.jwt.claims', true), '') IS NULL THEN NULL
      ELSE current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
    END
  );
$$;

ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_user_id_fkey;
ALTER TABLE public.execution_log DROP CONSTRAINT IF EXISTS execution_log_user_id_fkey;
ALTER TABLE public.connected_accounts DROP CONSTRAINT IF EXISTS connected_accounts_user_id_fkey;
ALTER TABLE public.policy_rules DROP CONSTRAINT IF EXISTS policy_rules_user_id_fkey;
ALTER TABLE public.ciba_requests DROP CONSTRAINT IF EXISTS ciba_requests_user_id_fkey;

-- Policies must be dropped before ALTER COLUMN user_id (Postgres blocks altering columns referenced by policies)
DROP POLICY IF EXISTS "Users can view permissions for their missions" ON public.mission_permissions;
DROP POLICY IF EXISTS "Users can create permissions for their missions" ON public.mission_permissions;

DROP POLICY IF EXISTS "Users can view their own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can create their own missions" ON public.missions;
DROP POLICY IF EXISTS "Users can update their own missions" ON public.missions;

DROP POLICY IF EXISTS "Users can view their own execution logs" ON public.execution_log;
DROP POLICY IF EXISTS "Users can insert their own execution logs" ON public.execution_log;

DROP POLICY IF EXISTS "Users can view their own connected accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Users can manage their own connected accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Users can update their own connected accounts" ON public.connected_accounts;
DROP POLICY IF EXISTS "Users can delete their own connected accounts" ON public.connected_accounts;

DROP POLICY IF EXISTS "Users can view their own policy rules" ON public.policy_rules;
DROP POLICY IF EXISTS "Users can create their own policy rules" ON public.policy_rules;
DROP POLICY IF EXISTS "Users can update their own policy rules" ON public.policy_rules;

DROP POLICY IF EXISTS "Users can view their own ciba requests" ON public.ciba_requests;
DROP POLICY IF EXISTS "Users can create their own ciba requests" ON public.ciba_requests;
DROP POLICY IF EXISTS "Users can update their own ciba requests" ON public.ciba_requests;

DROP POLICY IF EXISTS "Users can view own trust scores" ON public.agent_trust_scores;
DROP POLICY IF EXISTS "Users can insert own trust scores" ON public.agent_trust_scores;
DROP POLICY IF EXISTS "Users can update own trust scores" ON public.agent_trust_scores;

DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;

DROP POLICY IF EXISTS "Users can view own nudges" ON public.user_nudges;
DROP POLICY IF EXISTS "Users can insert own nudges" ON public.user_nudges;
DROP POLICY IF EXISTS "Users can update own nudges" ON public.user_nudges;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

ALTER TABLE public.missions ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.execution_log ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.connected_accounts ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.policy_rules ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.ciba_requests ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.agent_trust_scores ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.user_settings ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.user_nudges ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.notifications ALTER COLUMN user_id TYPE text USING user_id::text;

CREATE POLICY "Users can view their own missions" ON public.missions FOR SELECT USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can create their own missions" ON public.missions FOR INSERT WITH CHECK (public.requesting_sub() = user_id);
CREATE POLICY "Users can update their own missions" ON public.missions FOR UPDATE USING (public.requesting_sub() = user_id);

CREATE POLICY "Users can view permissions for their missions"
ON public.mission_permissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.missions
    WHERE missions.id = mission_permissions.mission_id
      AND missions.user_id = public.requesting_sub()
  )
);
CREATE POLICY "Users can create permissions for their missions"
ON public.mission_permissions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.missions
    WHERE missions.id = mission_permissions.mission_id
      AND missions.user_id = public.requesting_sub()
  )
);

CREATE POLICY "Users can view their own execution logs" ON public.execution_log FOR SELECT USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can insert their own execution logs" ON public.execution_log FOR INSERT WITH CHECK (public.requesting_sub() = user_id);

CREATE POLICY "Users can view their own connected accounts" ON public.connected_accounts FOR SELECT USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can manage their own connected accounts" ON public.connected_accounts FOR INSERT WITH CHECK (public.requesting_sub() = user_id);
CREATE POLICY "Users can update their own connected accounts" ON public.connected_accounts FOR UPDATE USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can delete their own connected accounts" ON public.connected_accounts FOR DELETE USING (public.requesting_sub() = user_id);

CREATE POLICY "Users can view their own policy rules" ON public.policy_rules FOR SELECT USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can create their own policy rules" ON public.policy_rules FOR INSERT WITH CHECK (public.requesting_sub() = user_id);
CREATE POLICY "Users can update their own policy rules" ON public.policy_rules FOR UPDATE USING (public.requesting_sub() = user_id);

CREATE POLICY "Users can view their own ciba requests" ON public.ciba_requests FOR SELECT USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can create their own ciba requests" ON public.ciba_requests FOR INSERT WITH CHECK (public.requesting_sub() = user_id);
CREATE POLICY "Users can update their own ciba requests" ON public.ciba_requests FOR UPDATE USING (public.requesting_sub() = user_id);

CREATE POLICY "Users can view own trust scores" ON public.agent_trust_scores FOR SELECT USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can insert own trust scores" ON public.agent_trust_scores FOR INSERT WITH CHECK (public.requesting_sub() = user_id);
CREATE POLICY "Users can update own trust scores" ON public.agent_trust_scores FOR UPDATE USING (public.requesting_sub() = user_id);

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (public.requesting_sub() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (public.requesting_sub() = user_id);

CREATE POLICY "Users can view own nudges" ON public.user_nudges FOR SELECT USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can insert own nudges" ON public.user_nudges FOR INSERT WITH CHECK (public.requesting_sub() = user_id);
CREATE POLICY "Users can update own nudges" ON public.user_nudges FOR UPDATE USING (public.requesting_sub() = user_id);

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (public.requesting_sub() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (public.requesting_sub() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (public.requesting_sub() = user_id);
