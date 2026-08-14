CREATE OR REPLACE FUNCTION public.remove_family_member(_member_id uuid, _purge boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _family uuid;
  _user uuid;
  _purged jsonb := '{}'::jsonb;
  _cancelled int := 0;
  _unlinked int := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Nisi prijavljen.';
  END IF;

  SELECT family_id, linked_user_id INTO _family, _user
  FROM public.family_members WHERE id = _member_id;

  IF _family IS NULL THEN
    RAISE EXCEPTION 'Član ne postoji.';
  END IF;

  IF NOT public.is_family_adult(_family) THEN
    RAISE EXCEPTION 'Nemaš ovlasti za ovu akciju.';
  END IF;

  IF _user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.family_users
    WHERE family_id = _family AND user_id = _user AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Vlasnika prostora nije moguće ukloniti.';
  END IF;

  IF _purge THEN
    _purged := public.purge_member_data(_member_id, 'all');
  END IF;

  -- Future reminders meant only for this person are cancelled; shared ones just lose the recipient.
  IF _user IS NOT NULL THEN
    WITH upd AS (
      UPDATE public.event_reminders r
        SET cancelled_at = now()
      FROM public.family_events e
      WHERE e.id = r.event_id
        AND e.family_id = _family
        AND r.cancelled_at IS NULL
        AND r.sent_at IS NULL
        AND r.remind_at > now()
        AND r.recipient_user_ids = ARRAY[_user]::uuid[]
      RETURNING 1
    )
    SELECT count(*) INTO _cancelled FROM upd;

    UPDATE public.event_reminders r
      SET recipient_user_ids = array_remove(r.recipient_user_ids, _user)
    FROM public.family_events e
    WHERE e.id = r.event_id
      AND e.family_id = _family
      AND r.sent_at IS NULL
      AND r.remind_at > now()
      AND _user = ANY(r.recipient_user_ids);
  END IF;

  -- Drop the person from upcoming obligations; past history stays untouched.
  WITH del AS (
    DELETE FROM public.event_members em
    USING public.family_events e
    WHERE e.id = em.event_id
      AND e.family_id = _family
      AND em.family_member_id = _member_id
      AND (e.date IS NULL OR e.date >= current_date)
    RETURNING 1
  )
  SELECT count(*) INTO _unlinked FROM del;

  DELETE FROM public.member_visibility WHERE family_member_id = _member_id;

  UPDATE public.family_invitations
    SET status = 'cancelled'
    WHERE family_id = _family AND family_member_id = _member_id AND status = 'pending';

  DELETE FROM public.family_members WHERE id = _member_id AND family_id = _family;

  IF _user IS NOT NULL THEN
    DELETE FROM public.family_users WHERE family_id = _family AND user_id = _user;
  END IF;

  RETURN jsonb_build_object(
    'purged', _purged,
    'cancelled_reminders', _cancelled,
    'unlinked_upcoming', _unlinked,
    'account_kept', _user IS NOT NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_family_member(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_family_member(uuid, boolean) TO authenticated;