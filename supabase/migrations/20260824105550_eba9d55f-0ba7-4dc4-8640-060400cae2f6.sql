ALTER TABLE public.family_members ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.delete_my_account(_new_owner_user_id uuid DEFAULT NULL::uuid)
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
        DELETE FROM public.event_members em USING public.family_events e
          WHERE e.id = em.event_id AND em.family_member_id = _member
            AND e.family_id = _family AND (e.date IS NULL OR e.date >= current_date);

        DELETE FROM public.member_visibility WHERE family_member_id = _member;

        UPDATE public.family_members
          SET name = 'Bivši član', linked_user_id = NULL, archived_at = now()
          WHERE id = _member;
      END IF;

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