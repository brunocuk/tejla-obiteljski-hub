CREATE OR REPLACE FUNCTION public.purge_member_data(_member_id uuid, _scope text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _family uuid;
  _user uuid;
  _archived timestamptz;
  _deleted_events int := 0;
  _unlinked int := 0;
  _deleted_reminders int := 0;
  _rec record;
  _others int;
BEGIN
  IF _scope NOT IN ('tasks', 'events', 'reminders', 'all') THEN
    RAISE EXCEPTION 'Nepoznata akcija.';
  END IF;

  SELECT family_id, linked_user_id, archived_at INTO _family, _user, _archived
  FROM public.family_members WHERE id = _member_id;

  IF _family IS NULL OR NOT public.is_family_adult(_family) THEN
    RAISE EXCEPTION 'Nemaš ovlasti za ovu akciju.';
  END IF;

  IF _archived IS NOT NULL THEN
    RAISE EXCEPTION 'Ovo je povijesni zapis bivšeg člana i njegovi se podaci ne mogu brisati.';
  END IF;

  -- Reminders scope: never touches events themselves.
  IF _scope IN ('reminders', 'all') THEN
    WITH target AS (
      SELECT r.id
      FROM public.event_reminders r
      JOIN public.family_events e ON e.id = r.event_id
      WHERE e.family_id = _family
        AND EXISTS (
          SELECT 1 FROM public.event_members em
          WHERE em.event_id = e.id AND em.family_member_id = _member_id
        )
    ), del AS (
      DELETE FROM public.event_reminders r USING target t WHERE r.id = t.id RETURNING 1
    )
    SELECT count(*) INTO _deleted_reminders FROM del;

    IF _user IS NOT NULL THEN
      UPDATE public.event_reminders r
        SET recipient_user_ids = array_remove(r.recipient_user_ids, _user)
      FROM public.family_events e
      WHERE e.id = r.event_id AND e.family_id = _family AND _user = ANY(r.recipient_user_ids);

      WITH del2 AS (
        DELETE FROM public.event_reminders r
        USING public.family_events e
        WHERE e.id = r.event_id
          AND e.family_id = _family
          AND r.recipient_mode = 'custom'
          AND coalesce(array_length(r.recipient_user_ids, 1), 0) = 0
        RETURNING 1
      )
      SELECT _deleted_reminders + count(*) INTO _deleted_reminders FROM del2;
    END IF;
  END IF;

  IF _scope IN ('tasks', 'events', 'all') THEN
    FOR _rec IN
      SELECT e.id
      FROM public.family_events e
      JOIN public.event_members em ON em.event_id = e.id
      WHERE e.family_id = _family
        AND em.family_member_id = _member_id
        AND (
          _scope = 'all'
          OR (_scope = 'tasks' AND e.type = 'task')
          OR (_scope = 'events' AND e.type <> 'task')
        )
    LOOP
      SELECT count(*) INTO _others
      FROM public.event_members
      WHERE event_id = _rec.id AND family_member_id <> _member_id;

      IF _others > 0 THEN
        DELETE FROM public.event_members
        WHERE event_id = _rec.id AND family_member_id = _member_id;
        _unlinked := _unlinked + 1;
      ELSE
        DELETE FROM public.family_events WHERE id = _rec.id AND family_id = _family;
        _deleted_events := _deleted_events + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'deleted_events', _deleted_events,
    'unlinked_events', _unlinked,
    'deleted_reminders', _deleted_reminders
  );
END;
$function$;