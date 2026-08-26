ALTER TABLE public.event_reminders
  DROP CONSTRAINT IF EXISTS event_reminders_recurring_needs_offset_check;

ALTER TABLE public.event_reminders
  ADD CONSTRAINT event_reminders_recurring_needs_offset_check
  CHECK (
    is_recurring = false
    OR (offset_kind = 'relative' AND offset_minutes IS NOT NULL)
    OR (offset_kind = 'calendar' AND days_before IS NOT NULL)
  );