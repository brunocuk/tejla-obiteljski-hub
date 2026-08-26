-- 1) Additive recurrence columns on family_events.
ALTER TABLE public.family_events
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS recurrence_freq text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_byday text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS recurrence_until date,
  ADD COLUMN IF NOT EXISTS recurrence_note text;

ALTER TABLE public.family_events
  DROP CONSTRAINT IF EXISTS family_events_recurrence_freq_check;
ALTER TABLE public.family_events
  ADD CONSTRAINT family_events_recurrence_freq_check
  CHECK (recurrence_freq IS NULL OR recurrence_freq IN ('daily', 'weekly', 'monthly'));

ALTER TABLE public.family_events
  DROP CONSTRAINT IF EXISTS family_events_recurrence_interval_check;
ALTER TABLE public.family_events
  ADD CONSTRAINT family_events_recurrence_interval_check
  CHECK (recurrence_interval >= 1 AND recurrence_interval <= 52);

-- V1: recurring is only allowed for events, never tasks, and needs a start date.
ALTER TABLE public.family_events
  DROP CONSTRAINT IF EXISTS family_events_recurrence_event_only_check;
ALTER TABLE public.family_events
  ADD CONSTRAINT family_events_recurrence_event_only_check
  CHECK (recurrence_freq IS NULL OR (type = 'event' AND date IS NOT NULL));

CREATE INDEX IF NOT EXISTS family_events_recurring_idx
  ON public.family_events (family_id) WHERE recurrence_freq IS NOT NULL;

-- 2) Per-occurrence overrides. Identity is ALWAYS the original occurrence date;
--    a moved occurrence keeps it and only changes its effective date.
CREATE TABLE IF NOT EXISTS public.event_occurrence_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.family_events(id) ON DELETE CASCADE,
  original_occurrence_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('skipped', 'modified')),
  effective_date date,
  start_time time,
  end_time time,
  title text,
  location text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, original_occurrence_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_occurrence_overrides TO authenticated;
GRANT ALL ON public.event_occurrence_overrides TO service_role;
ALTER TABLE public.event_occurrence_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view occurrence overrides"
  ON public.event_occurrence_overrides FOR SELECT TO authenticated
  USING (public.can_access_event(event_id));
CREATE POLICY "Editors can create occurrence overrides"
  ON public.event_occurrence_overrides FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_event(event_id) AND created_by = auth.uid());
CREATE POLICY "Editors can update occurrence overrides"
  ON public.event_occurrence_overrides FOR UPDATE TO authenticated
  USING (public.can_edit_event(event_id))
  WITH CHECK (public.can_edit_event(event_id));
CREATE POLICY "Editors can delete occurrence overrides"
  ON public.event_occurrence_overrides FOR DELETE TO authenticated
  USING (public.can_edit_event(event_id));

CREATE TRIGGER update_event_occurrence_overrides_updated_at
  BEFORE UPDATE ON public.event_occurrence_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Recurring reminder support (additive; NULL offset = existing one-off behaviour).
ALTER TABLE public.event_reminders
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS offset_minutes integer;

ALTER TABLE public.event_reminders
  DROP CONSTRAINT IF EXISTS event_reminders_recurring_needs_offset_check;
ALTER TABLE public.event_reminders
  ADD CONSTRAINT event_reminders_recurring_needs_offset_check
  CHECK (is_recurring = false OR offset_minutes IS NOT NULL);

-- 4) One materialized delivery slot per reminder per ORIGINAL occurrence date.
--    The unique key is the dedupe guard against two parallel cron runs.
CREATE TABLE IF NOT EXISTS public.reminder_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.event_reminders(id) ON DELETE CASCADE,
  original_occurrence_date date NOT NULL,
  effective_date date NOT NULL,
  remind_at timestamptz NOT NULL,
  sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reminder_id, original_occurrence_date)
);

GRANT SELECT ON public.reminder_occurrences TO authenticated;
GRANT ALL ON public.reminder_occurrences TO service_role;
ALTER TABLE public.reminder_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reminder occurrences"
  ON public.reminder_occurrences FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_reminders r
    WHERE r.id = reminder_occurrences.reminder_id
      AND public.can_access_event(r.event_id)
  ));

CREATE INDEX IF NOT EXISTS reminder_occurrences_due_idx
  ON public.reminder_occurrences (remind_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

-- 5) Children still cannot rewrite an adult-created series.
CREATE OR REPLACE FUNCTION public.guard_family_event_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('tejla.account_deletion', true) = '1' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.is_family_adult(OLD.family_id) THEN RETURN NEW; END IF;
  IF OLD.created_by = auth.uid() THEN RETURN NEW; END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.date IS DISTINCT FROM OLD.date
     OR NEW.time IS DISTINCT FROM OLD.time
     OR NEW.end_time IS DISTINCT FROM OLD.end_time
     OR NEW.location IS DISTINCT FROM OLD.location
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.deadline IS DISTINCT FROM OLD.deadline
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.things_to_bring IS DISTINCT FROM OLD.things_to_bring
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.linked_event_id IS DISTINCT FROM OLD.linked_event_id
     OR NEW.family_id IS DISTINCT FROM OLD.family_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.recurrence_freq IS DISTINCT FROM OLD.recurrence_freq
     OR NEW.recurrence_interval IS DISTINCT FROM OLD.recurrence_interval
     OR NEW.recurrence_byday IS DISTINCT FROM OLD.recurrence_byday
     OR NEW.recurrence_until IS DISTINCT FROM OLD.recurrence_until
     OR NEW.recurrence_note IS DISTINCT FROM OLD.recurrence_note THEN
    RAISE EXCEPTION 'Ovu obavezu je unijela odrasla osoba, pa možeš promijeniti samo je li riješena.';
  END IF;

  RETURN NEW;
END;
$function$;