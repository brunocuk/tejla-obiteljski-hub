CREATE OR REPLACE FUNCTION public.can_view_event_row(_event_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _my_member uuid;
  _mode text;
  _see_own boolean := true;
  _see_shared boolean := true;
  _allowed uuid[] := '{}';
  _links int;
  _members int;
BEGIN
  IF _uid IS NULL OR _family_id IS NULL THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_users WHERE family_id = _family_id AND user_id = _uid
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.family_users
    WHERE family_id = _family_id AND user_id = _uid AND role IN ('owner', 'parent')
  ) THEN
    RETURN true;
  END IF;

  SELECT id INTO _my_member
  FROM public.family_members
  WHERE family_id = _family_id AND linked_user_id = _uid
  LIMIT 1;

  SELECT mode, see_own, see_shared, allowed_member_ids
    INTO _mode, _see_own, _see_shared, _allowed
  FROM public.member_visibility
  WHERE family_member_id = _my_member;

  _mode := coalesce(_mode, 'own_shared');
  IF _mode = 'all' THEN RETURN true; END IF;

  SELECT count(*) INTO _links FROM public.event_members WHERE event_id = _event_id;
  SELECT count(*) INTO _members FROM public.family_members WHERE family_id = _family_id;

  IF _my_member IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_members
    WHERE event_id = _event_id AND family_member_id = _my_member
  ) THEN
    IF _mode = 'custom' THEN RETURN coalesce(_see_own, true); END IF;
    RETURN true;
  END IF;

  IF _links = 0 OR (_members > 0 AND _links >= _members) THEN
    IF _mode = 'own_shared' THEN RETURN true; END IF;
    IF _mode = 'custom' THEN RETURN coalesce(_see_shared, true); END IF;
    RETURN false;
  END IF;

  IF _mode = 'custom' AND EXISTS (
    SELECT 1 FROM public.event_members em
    WHERE em.event_id = _event_id AND em.family_member_id = ANY(_allowed)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.can_view_event_row(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_event_row(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Members can view family events" ON public.family_events;
CREATE POLICY "Members can view family events"
ON public.family_events FOR SELECT TO authenticated
USING (public.can_view_event_row(id, family_id));

DROP POLICY IF EXISTS "Members can delete family events" ON public.family_events;
CREATE POLICY "Members can delete family events"
ON public.family_events FOR DELETE TO authenticated
USING (public.can_view_event_row(id, family_id));

DROP POLICY IF EXISTS "Members can update family events" ON public.family_events;
CREATE POLICY "Members can update family events"
ON public.family_events FOR UPDATE TO authenticated
USING (public.can_view_event_row(id, family_id))
WITH CHECK (public.is_family_member(family_id));