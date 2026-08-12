CREATE TABLE public.event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.family_events(id) ON DELETE CASCADE,
  remind_at timestamptz NOT NULL,
  recipient_mode text NOT NULL DEFAULT 'all_parents' CHECK (recipient_mode IN ('all_parents','creator_only')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_reminders TO authenticated;
GRANT ALL ON public.event_reminders TO service_role;

ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view event reminders" ON public.event_reminders
  FOR SELECT TO authenticated USING (public.can_access_event(event_id));
CREATE POLICY "Members can create event reminders" ON public.event_reminders
  FOR INSERT TO authenticated WITH CHECK (public.can_access_event(event_id) AND created_by = auth.uid());
CREATE POLICY "Members can update event reminders" ON public.event_reminders
  FOR UPDATE TO authenticated USING (public.can_access_event(event_id)) WITH CHECK (public.can_access_event(event_id));
CREATE POLICY "Members can delete event reminders" ON public.event_reminders
  FOR DELETE TO authenticated USING (public.can_access_event(event_id));

CREATE INDEX event_reminders_due_idx ON public.event_reminders (remind_at) WHERE sent_at IS NULL;
CREATE INDEX event_reminders_event_idx ON public.event_reminders (event_id);

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());