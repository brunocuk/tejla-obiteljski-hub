CREATE TABLE public.user_notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tejla_messages_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_prefs TO authenticated;
GRANT ALL ON public.user_notification_prefs TO service_role;

ALTER TABLE public.user_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notification prefs"
  ON public.user_notification_prefs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own notification prefs"
  ON public.user_notification_prefs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own notification prefs"
  ON public.user_notification_prefs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own notification prefs"
  ON public.user_notification_prefs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_user_notification_prefs_updated_at
  BEFORE UPDATE ON public.user_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS notification_events_user_kind_created_idx
  ON public.notification_events (user_id, kind, created_at DESC);
