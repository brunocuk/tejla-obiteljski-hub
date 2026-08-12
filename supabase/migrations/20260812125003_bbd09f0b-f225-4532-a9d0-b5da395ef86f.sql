-- 1. Edit/delete rights for events (separate from visibility)
CREATE OR REPLACE FUNCTION public.can_edit_event_row(_event_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _my_member uuid;
  _created_by uuid;
BEGIN
  IF _uid IS NULL OR _family_id IS NULL THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_users WHERE family_id = _family_id AND user_id = _uid
  ) THEN
    RETURN false;
  END IF;

  -- Adults keep exactly the previous behaviour.
  IF public.is_family_adult(_family_id) THEN
    RETURN public.can_view_event_row(_event_id, _family_id);
  END IF;

  -- Children may only touch what they created or what is theirs, and only if visible to them.
  IF NOT public.can_view_event_row(_event_id, _family_id) THEN RETURN false; END IF;

  SELECT created_by INTO _created_by FROM public.family_events WHERE id = _event_id;
  IF _created_by = _uid THEN RETURN true; END IF;

  SELECT id INTO _my_member
  FROM public.family_members
  WHERE family_id = _family_id AND linked_user_id = _uid
  LIMIT 1;

  IF _my_member IS NULL THEN RETURN false; END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.event_members
    WHERE event_id = _event_id AND family_member_id = _my_member
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_edit_event(_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _family uuid;
BEGIN
  SELECT family_id INTO _family FROM public.family_events WHERE id = _event_id;
  IF _family IS NULL THEN RETURN false; END IF;
  RETURN public.can_edit_event_row(_event_id, _family);
END;
$$;

DROP POLICY IF EXISTS "Members can update family events" ON public.family_events;
CREATE POLICY "Members can update family events"
  ON public.family_events FOR UPDATE TO authenticated
  USING (public.can_edit_event_row(id, family_id))
  WITH CHECK (public.is_family_member(family_id) AND public.can_edit_event_row(id, family_id));

DROP POLICY IF EXISTS "Members can delete family events" ON public.family_events;
CREATE POLICY "Members can delete family events"
  ON public.family_events FOR DELETE TO authenticated
  USING (public.can_edit_event_row(id, family_id));

DROP POLICY IF EXISTS "Members can link event members" ON public.event_members;
CREATE POLICY "Members can link event members"
  ON public.event_members FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_event(event_id));

DROP POLICY IF EXISTS "Members can update event members" ON public.event_members;
CREATE POLICY "Members can update event members"
  ON public.event_members FOR UPDATE TO authenticated
  USING (public.can_edit_event(event_id))
  WITH CHECK (public.can_edit_event(event_id));

DROP POLICY IF EXISTS "Members can unlink event members" ON public.event_members;
CREATE POLICY "Members can unlink event members"
  ON public.event_members FOR DELETE TO authenticated
  USING (public.can_edit_event(event_id));

DROP POLICY IF EXISTS "Members can create event reminders" ON public.event_reminders;
CREATE POLICY "Members can create event reminders"
  ON public.event_reminders FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_event(event_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Members can update event reminders" ON public.event_reminders;
CREATE POLICY "Members can update event reminders"
  ON public.event_reminders FOR UPDATE TO authenticated
  USING (public.can_edit_event(event_id))
  WITH CHECK (public.can_edit_event(event_id));

DROP POLICY IF EXISTS "Members can delete event reminders" ON public.event_reminders;
CREATE POLICY "Members can delete event reminders"
  ON public.event_reminders FOR DELETE TO authenticated
  USING (public.can_edit_event(event_id));

-- 2. Only adults may change the family space
DROP POLICY IF EXISTS "Members can update their family" ON public.families;
CREATE POLICY "Adults can update their family"
  ON public.families FOR UPDATE TO authenticated
  USING (public.is_family_adult(id))
  WITH CHECK (public.is_family_adult(id));

-- 3. Invitations (emails) are adult-only
DROP POLICY IF EXISTS "Members can view family invitations" ON public.family_invitations;
CREATE POLICY "Adults can view family invitations"
  ON public.family_invitations FOR SELECT TO authenticated
  USING (public.is_family_adult(family_id));

-- 4. Children may only edit their own display name on their member row
CREATE OR REPLACE FUNCTION public.guard_family_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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
$$;

DROP TRIGGER IF EXISTS guard_family_member_update ON public.family_members;
CREATE TRIGGER guard_family_member_update
  BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_family_member_update();