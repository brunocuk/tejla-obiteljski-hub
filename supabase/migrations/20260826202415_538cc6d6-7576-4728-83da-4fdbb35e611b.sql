-- Any change to a single occurrence invalidates its not-yet-sent reminder slot;
-- the next materialization pass recreates it at the correct time.
CREATE OR REPLACE FUNCTION public.sync_reminder_occurrences_for_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _row public.event_occurrence_overrides%ROWTYPE;
BEGIN
  _row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  DELETE FROM public.reminder_occurrences ro
  USING public.event_reminders rem
  WHERE rem.id = ro.reminder_id
    AND rem.event_id = _row.event_id
    AND ro.original_occurrence_date = _row.original_occurrence_date
    AND ro.sent_at IS NULL;

  RETURN _row;
END;
$function$;

DROP TRIGGER IF EXISTS sync_reminder_occurrences_for_override ON public.event_occurrence_overrides;
CREATE TRIGGER sync_reminder_occurrences_for_override
  AFTER INSERT OR UPDATE OR DELETE ON public.event_occurrence_overrides
  FOR EACH ROW EXECUTE FUNCTION public.sync_reminder_occurrences_for_override();

-- Shortening or retiming a series drops the pending slots that no longer apply.
CREATE OR REPLACE FUNCTION public.sync_reminder_occurrences_for_series()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.recurrence_freq IS NULL AND OLD.recurrence_freq IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.recurrence_until IS DISTINCT FROM OLD.recurrence_until
     OR NEW.recurrence_freq IS DISTINCT FROM OLD.recurrence_freq
     OR NEW.recurrence_interval IS DISTINCT FROM OLD.recurrence_interval
     OR NEW.recurrence_byday IS DISTINCT FROM OLD.recurrence_byday
     OR NEW.date IS DISTINCT FROM OLD.date
     OR NEW.time IS DISTINCT FROM OLD.time THEN
    DELETE FROM public.reminder_occurrences ro
    USING public.event_reminders rem
    WHERE rem.id = ro.reminder_id
      AND rem.event_id = NEW.id
      AND ro.sent_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_reminder_occurrences_for_series ON public.family_events;
CREATE TRIGGER sync_reminder_occurrences_for_series
  AFTER UPDATE ON public.family_events
  FOR EACH ROW EXECUTE FUNCTION public.sync_reminder_occurrences_for_series();

REVOKE ALL ON FUNCTION public.sync_reminder_occurrences_for_override() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_reminder_occurrences_for_series() FROM PUBLIC, anon, authenticated;