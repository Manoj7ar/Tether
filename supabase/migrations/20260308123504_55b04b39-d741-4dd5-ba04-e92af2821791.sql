
-- 1. Agent Trust Scores table
CREATE TABLE public.agent_trust_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL DEFAULT 100,
  total_allowed INTEGER NOT NULL DEFAULT 0,
  total_blocked INTEGER NOT NULL DEFAULT 0,
  history_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_trust_scores ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_agent_trust_scores_user ON public.agent_trust_scores(user_id);

CREATE POLICY "Users can view own trust scores" ON public.agent_trust_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trust scores" ON public.agent_trust_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trust scores" ON public.agent_trust_scores FOR UPDATE USING (auth.uid() = user_id);

-- 2. User Settings table (MCP + Ambient)
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mcp_enabled BOOLEAN NOT NULL DEFAULT false,
  ambient_enabled BOOLEAN NOT NULL DEFAULT false,
  ambient_budget_max INTEGER NOT NULL DEFAULT 50,
  ambient_budget_used INTEGER NOT NULL DEFAULT 0,
  ambient_budget_window_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ambient_allowed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_user_settings_user ON public.user_settings(user_id);

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- 3. User Nudges table
CREATE TABLE public.user_nudges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nudges_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  dismissed_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_nudges ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_user_nudges_user ON public.user_nudges(user_id);

CREATE POLICY "Users can view own nudges" ON public.user_nudges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nudges" ON public.user_nudges FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nudges" ON public.user_nudges FOR UPDATE USING (auth.uid() = user_id);
