-- 1) Events vs tasks on the existing obligations table
ALTER TABLE public.family_events
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_event_id uuid REFERENCES public.family_events(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.family_events
    ADD CONSTRAINT family_events_type_check CHECK (type IN ('event', 'task'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS family_events_linked_event_id_idx ON public.family_events(linked_event_id);
CREATE INDEX IF NOT EXISTS family_events_type_idx ON public.family_events(family_id, type);

-- 2) Recurrence metadata on the existing reminder table (delivery stays row-based)
ALTER TABLE public.event_reminders
  ADD COLUMN IF NOT EXISTS pattern text NOT NULL DEFAULT 'once',
  ADD COLUMN IF NOT EXISTS series_id uuid;

CREATE INDEX IF NOT EXISTS event_reminders_series_idx ON public.event_reminders(series_id);