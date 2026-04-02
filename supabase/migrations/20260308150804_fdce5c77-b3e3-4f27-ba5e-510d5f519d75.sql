-- Drop and recreate triggers to ensure they're correctly attached
DROP TRIGGER IF EXISTS trg_mission_status_notification ON public.missions;
DROP TRIGGER IF EXISTS trg_execution_blocked_notification ON public.execution_log;

CREATE TRIGGER trg_mission_status_notification
  AFTER UPDATE ON public.missions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_mission_status_change();

CREATE TRIGGER trg_execution_blocked_notification
  AFTER INSERT ON public.execution_log
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_execution_blocked();