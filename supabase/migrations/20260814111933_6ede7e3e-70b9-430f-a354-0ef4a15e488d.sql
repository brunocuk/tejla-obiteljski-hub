ALTER TABLE public.event_reminders
  ADD COLUMN IF NOT EXISTS recipient_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];