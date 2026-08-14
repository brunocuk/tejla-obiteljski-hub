ALTER TABLE public.event_reminders DROP CONSTRAINT IF EXISTS event_reminders_recipient_mode_check;
ALTER TABLE public.event_reminders ADD CONSTRAINT event_reminders_recipient_mode_check
  CHECK (recipient_mode = ANY (ARRAY['all_parents'::text, 'creator_only'::text, 'selected'::text, 'custom'::text]));