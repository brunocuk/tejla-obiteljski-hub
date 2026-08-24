-- Snapshot of the applied migration for user_notification_prefs.
-- Kept in sync manually so tests can assert the invariants that matter:
-- opt-in default OFF and automatic cleanup on account deletion.
CREATE TABLE public.user_notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tejla_messages_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
