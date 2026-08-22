DROP TABLE IF EXISTS public.assignment_notifications;

-- Client-agnostic notification events: business logic writes here, delivery reads it.
CREATE TABLE public.notification_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  subject_type text NOT NULL DEFAULT 'family_event',
  subject_id uuid,
  title text NOT NULL DEFAULT 'Tejla',
  body text NOT NULL DEFAULT '',
  deep_link text NOT NULL DEFAULT '/',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX notification_events_user_idx ON public.notification_events (user_id, created_at DESC);

GRANT SELECT ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own notifications"
  ON public.notification_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- One row per (notification, channel, target device). Keeps delivery attempts auditable.
CREATE TABLE public.notification_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  channel text NOT NULL,
  target_ref text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  UNIQUE (notification_event_id, channel, target_ref)
);
GRANT ALL ON public.notification_deliveries TO service_role;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Future native clients (Flutter iOS/Android) register device tokens here.
CREATE TABLE public.device_push_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  provider text NOT NULL DEFAULT 'fcm',
  token text NOT NULL UNIQUE,
  app_version text,
  disabled_at timestamp with time zone,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX device_push_tokens_user_idx ON public.device_push_tokens (user_id) WHERE disabled_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT ALL ON public.device_push_tokens TO service_role;
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own device tokens"
  ON public.device_push_tokens FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());