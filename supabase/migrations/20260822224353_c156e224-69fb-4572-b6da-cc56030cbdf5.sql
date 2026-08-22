CREATE TABLE public.assignment_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.family_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT ALL ON public.assignment_notifications TO service_role;
ALTER TABLE public.assignment_notifications ENABLE ROW LEVEL SECURITY;