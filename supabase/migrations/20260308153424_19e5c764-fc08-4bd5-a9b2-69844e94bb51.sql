-- Unique constraints for upserts
ALTER TABLE public.agent_trust_scores ADD CONSTRAINT agent_trust_scores_user_id_key UNIQUE (user_id);
ALTER TABLE public.user_nudges ADD CONSTRAINT user_nudges_user_id_key UNIQUE (user_id);
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);
ALTER TABLE public.connected_accounts ADD CONSTRAINT connected_accounts_user_id_provider_key UNIQUE (user_id, provider);

-- Notification triggers
CREATE TRIGGER on_mission_status_change
  AFTER UPDATE ON public.missions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_mission_status_change();

CREATE TRIGGER on_execution_log_blocked
  AFTER INSERT ON public.execution_log
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_execution_blocked();