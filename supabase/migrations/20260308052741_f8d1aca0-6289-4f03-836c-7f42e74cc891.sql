
-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- MISSIONS TABLE
CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tether_number SERIAL,
  objective TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_approval', 'approved', 'active', 'completed', 'expired', 'rejected')),
  manifest_json JSONB,
  policy_check JSONB,
  intent_audit JSONB,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  time_limit_mins INTEGER DEFAULT 30,
  expires_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own missions" ON public.missions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own missions" ON public.missions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own missions" ON public.missions FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MISSION PERMISSIONS TABLE
CREATE TABLE public.mission_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  scope TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('read', 'write')),
  reason TEXT
);

ALTER TABLE public.mission_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view permissions for their missions" ON public.mission_permissions FOR SELECT USING (EXISTS (SELECT 1 FROM public.missions WHERE missions.id = mission_permissions.mission_id AND missions.user_id = auth.uid()));
CREATE POLICY "Users can create permissions for their missions" ON public.mission_permissions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.missions WHERE missions.id = mission_permissions.mission_id AND missions.user_id = auth.uid()));

-- EXECUTION LOG TABLE
CREATE TABLE public.execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('allowed', 'blocked')),
  block_reason TEXT,
  block_type TEXT CHECK (block_type IN ('scope_violation', 'policy_violation', 'mission_expired')),
  result_summary TEXT,
  params_json JSONB
);

ALTER TABLE public.execution_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own execution logs" ON public.execution_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own execution logs" ON public.execution_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CONNECTED ACCOUNTS TABLE
CREATE TABLE public.connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_username TEXT,
  scopes TEXT[],
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connected accounts" ON public.connected_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own connected accounts" ON public.connected_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own connected accounts" ON public.connected_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own connected accounts" ON public.connected_accounts FOR DELETE USING (auth.uid() = user_id);

-- POLICY RULES TABLE
CREATE TABLE public.policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  rules_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.policy_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own policy rules" ON public.policy_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own policy rules" ON public.policy_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own policy rules" ON public.policy_rules FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_policy_rules_updated_at BEFORE UPDATE ON public.policy_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CIBA REQUESTS TABLE
CREATE TABLE public.ciba_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.ciba_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ciba requests" ON public.ciba_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own ciba requests" ON public.ciba_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ciba requests" ON public.ciba_requests FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.execution_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ciba_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missions;
