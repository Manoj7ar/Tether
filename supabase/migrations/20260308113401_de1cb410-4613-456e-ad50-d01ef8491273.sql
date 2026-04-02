
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- System can insert (via trigger with SECURITY DEFINER)
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function for mission status changes
CREATE OR REPLACE FUNCTION public.notify_mission_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notif_type text;
  notif_title text;
  notif_body text;
  tether_label text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  tether_label := 'Tether #' || LPAD(NEW.tether_number::text, 3, '0');

  CASE NEW.status
    WHEN 'active' THEN
      notif_type := 'mission_approved';
      notif_title := tether_label || ' approved';
      notif_body := 'Mission is now active: ' || LEFT(NEW.objective, 100);
    WHEN 'completed' THEN
      notif_type := 'mission_completed';
      notif_title := tether_label || ' completed';
      notif_body := 'Mission finished successfully.';
    WHEN 'rejected' THEN
      notif_type := 'mission_rejected';
      notif_title := tether_label || ' rejected';
      notif_body := 'Mission was rejected.';
    WHEN 'expired' THEN
      notif_type := 'mission_expired';
      notif_title := tether_label || ' expired';
      notif_body := 'Mission time limit reached.';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (user_id, type, title, body, mission_id)
  VALUES (NEW.user_id, notif_type, notif_title, notif_body, NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mission_status_notification
  AFTER UPDATE ON public.missions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_mission_status_change();

-- Trigger function for blocked execution log entries
CREATE OR REPLACE FUNCTION public.notify_execution_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tether_label text;
  m_record RECORD;
BEGIN
  IF NEW.status != 'blocked' THEN
    RETURN NEW;
  END IF;

  SELECT tether_number INTO m_record FROM public.missions WHERE id = NEW.mission_id;
  tether_label := 'Tether #' || LPAD(COALESCE(m_record.tether_number, 0)::text, 3, '0');

  INSERT INTO public.notifications (user_id, type, title, body, mission_id)
  VALUES (
    NEW.user_id,
    'mission_blocked',
    'Action blocked on ' || tether_label,
    'Blocked: ' || NEW.action || COALESCE(' — ' || NEW.block_reason, ''),
    NEW.mission_id
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_execution_blocked_notification
  AFTER INSERT ON public.execution_log
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_execution_blocked();
