-- 1. Allow authorship links to be emptied instead of blocking auth deletion
ALTER TABLE public.family_events ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.family_events DROP CONSTRAINT family_events_created_by_fkey;
ALTER TABLE public.family_events ADD CONSTRAINT family_events_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_reminders ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.event_reminders DROP CONSTRAINT event_reminders_created_by_fkey;
ALTER TABLE public.event_reminders ADD CONSTRAINT event_reminders_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.family_invitations DROP CONSTRAINT family_invitations_invited_by_fkey;
ALTER TABLE public.family_invitations ADD CONSTRAINT family_invitations_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.beta_invites DROP CONSTRAINT beta_invites_created_by_fkey;
ALTER TABLE public.beta_invites ADD CONSTRAINT beta_invites_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.beta_invites DROP CONSTRAINT beta_invites_used_by_fkey;
ALTER TABLE public.beta_invites ADD CONSTRAINT beta_invites_used_by_fkey
  FOREIGN KEY (used_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Deletion request ledger (no FK to auth.users on purpose: it must outlive the account)
CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  data_cleared_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deletion request"
ON public.account_deletion_requests FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_account_deletion_requests_updated_at
BEFORE UPDATE ON public.account_deletion_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Let the deletion routine anonymise its own member row even for child accounts
CREATE OR REPLACE FUNCTION public.guard_family_member_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('tejla.account_deletion', true) = '1' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.is_family_adult(OLD.family_id) THEN RETURN NEW; END IF;

  IF NEW.family_id IS DISTINCT FROM OLD.family_id
     OR NEW.member_type IS DISTINCT FROM OLD.member_type
     OR NEW.linked_user_id IS DISTINCT FROM OLD.linked_user_id
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Nemaš ovlasti za promjenu ovih podataka.';
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Preview: what will happen when I delete my account
CREATE OR REPLACE FUNCTION public.account_deletion_preview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _family uuid;
  _is_owner boolean := false;
  _others int := 0;
  _adults jsonb := '[]'::jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Nisi prijavljen.';
  END IF;

  SELECT family_id, role = 'owner' INTO _family, _is_owner
  FROM public.family_users WHERE user_id = _uid LIMIT 1;

  IF _family IS NULL THEN
    RETURN jsonb_build_object(
      'has_family', false, 'is_owner', false, 'other_users', 0,
      'deletes_family', false, 'needs_owner_transfer', false,
      'blocked', false, 'adult_candidates', '[]'::jsonb
    );
  END IF;

  SELECT count(*) INTO _others FROM public.family_users
  WHERE family_id = _family AND user_id <> _uid;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'user_id', fu.user_id,
    'name', coalesce(nullif(trim(fm.name), ''), nullif(trim(p.name), ''), p.email, 'Član')
  )), '[]'::jsonb) INTO _adults
  FROM public.family_users fu
  LEFT JOIN public.family_members fm ON fm.family_id = fu.family_id AND fm.linked_user_id = fu.user_id
  LEFT JOIN public.profiles p ON p.id = fu.user_id
  WHERE fu.family_id = _family AND fu.user_id <> _uid AND fu.role IN ('owner', 'parent');

  RETURN jsonb_build_object(
    'has_family', true,
    'is_owner', coalesce(_is_owner, false),
    'other_users', _others,
    'deletes_family', _others = 0,
    'needs_owner_transfer', coalesce(_is_owner, false) AND _others > 0 AND jsonb_array_length(_adults) > 0,
    'blocked', coalesce(_is_owner, false) AND _others > 0 AND jsonb_array_length(_adults) = 0,
    'adult_candidates', _adults
  );
END;
$function$;

-- 5. The deletion itself (app data phase); idempotent
CREATE OR REPLACE FUNCTION public.delete_my_account(_new_owner_user_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _family uuid;
  _is_owner boolean := false;
  _others int := 0;
  _member uuid;
  _family_deleted boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Nisi prijavljen.';
  END IF;

  PERFORM set_config('tejla.account_deletion', '1', true);

  INSERT INTO public.account_deletion_requests (user_id, status)
  VALUES (_uid, 'pending')
  ON CONFLICT (user_id) DO UPDATE SET status = 'pending', updated_at = now();

  SELECT family_id, role = 'owner' INTO _family, _is_owner
  FROM public.family_users WHERE user_id = _uid LIMIT 1;

  IF _family IS NOT NULL THEN
    SELECT count(*) INTO _others FROM public.family_users
    WHERE family_id = _family AND user_id <> _uid;

    IF coalesce(_is_owner, false) AND _others > 0 THEN
      IF _new_owner_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.family_users
        WHERE family_id = _family AND user_id = _new_owner_user_id
          AND user_id <> _uid AND role IN ('owner', 'parent')
      ) THEN
        RAISE EXCEPTION 'Prije brisanja odaberi drugu odraslu osobu koja preuzima obiteljski prostor.';
      END IF;

      UPDATE public.family_users SET role = 'owner'
      WHERE family_id = _family AND user_id = _new_owner_user_id;
    END IF;

    SELECT id INTO _member FROM public.family_members
    WHERE family_id = _family AND linked_user_id = _uid LIMIT 1;

    IF _others = 0 THEN
      -- Sole user: the whole space exists only because of this account.
      DELETE FROM public.notification_events WHERE family_id = _family;
      DELETE FROM public.event_reminders r USING public.family_events e
        WHERE e.id = r.event_id AND e.family_id = _family;
      DELETE FROM public.family_events WHERE family_id = _family;
      DELETE FROM public.member_visibility WHERE family_id = _family;
      DELETE FROM public.family_invitations WHERE family_id = _family;
      DELETE FROM public.family_members WHERE family_id = _family;
      DELETE FROM public.family_users WHERE family_id = _family;
      DELETE FROM public.families WHERE id = _family;
      _family_deleted := true;
    ELSE
      IF _member IS NOT NULL THEN
        -- Detach from everything still ahead; history keeps its participants.
        DELETE FROM public.event_members em USING public.family_events e
          WHERE e.id = em.event_id AND em.family_member_id = _member
            AND e.family_id = _family AND (e.date IS NULL OR e.date >= current_date);

        DELETE FROM public.member_visibility WHERE family_member_id = _member;

        -- Anonymised tombstone so shared past events stay accurate.
        UPDATE public.family_members
          SET name = 'Bivši član', linked_user_id = NULL
          WHERE id = _member;
      END IF;

      -- Future reminders addressed only to this person are cancelled.
      UPDATE public.event_reminders r SET cancelled_at = now()
      FROM public.family_events e
      WHERE e.id = r.event_id AND e.family_id = _family
        AND r.cancelled_at IS NULL AND r.sent_at IS NULL AND r.remind_at > now()
        AND r.recipient_user_ids = ARRAY[_uid]::uuid[];

      UPDATE public.event_reminders r
        SET recipient_user_ids = array_remove(r.recipient_user_ids, _uid)
      FROM public.family_events e
      WHERE e.id = r.event_id AND e.family_id = _family AND _uid = ANY(r.recipient_user_ids);

      UPDATE public.family_invitations SET status = 'cancelled'
      WHERE family_id = _family AND status = 'pending'
        AND (invited_by = _uid OR family_member_id = _member);

      DELETE FROM public.notification_events WHERE family_id = _family AND user_id = _uid;
      DELETE FROM public.family_users WHERE family_id = _family AND user_id = _uid;
    END IF;
  END IF;

  -- Account-scoped personal data, wherever it lives.
  DELETE FROM public.notification_events WHERE user_id = _uid;
  DELETE FROM public.push_subscriptions WHERE user_id = _uid;
  DELETE FROM public.device_push_tokens WHERE user_id = _uid;
  DELETE FROM public.app_admins WHERE user_id = _uid;
  UPDATE public.family_invitations SET status = 'cancelled'
    WHERE status = 'pending' AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', '@'));
  DELETE FROM public.profiles WHERE id = _uid;

  UPDATE public.account_deletion_requests
    SET status = 'data_cleared', data_cleared_at = now(), updated_at = now()
    WHERE user_id = _uid;

  RETURN jsonb_build_object('family_deleted', _family_deleted, 'user_id', _uid);
END;
$function$;