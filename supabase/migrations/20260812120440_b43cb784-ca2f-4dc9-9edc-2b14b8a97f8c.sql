-- 1) Invitations can bind to an existing member profile (child accounts)
ALTER TABLE public.family_invitations
  ADD COLUMN IF NOT EXISTS family_member_id uuid REFERENCES public.family_members(id) ON DELETE SET NULL;

-- 2) Adult helper (owner or parent)
CREATE OR REPLACE FUNCTION public.is_family_adult(_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_users
    WHERE family_id = _family_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'parent')
  )
$$;

-- 3) Per-child visibility settings
CREATE TABLE IF NOT EXISTS public.member_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL UNIQUE REFERENCES public.family_members(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'own_shared' CHECK (mode IN ('own', 'own_shared', 'all', 'custom')),
  see_own boolean NOT NULL DEFAULT true,
  see_shared boolean NOT NULL DEFAULT true,
  allowed_member_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_visibility TO authenticated;
GRANT ALL ON public.member_visibility TO service_role;

ALTER TABLE public.member_visibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view visibility settings" ON public.member_visibility;
CREATE POLICY "Members can view visibility settings"
  ON public.member_visibility FOR SELECT TO authenticated
  USING (public.is_family_member(family_id));

DROP POLICY IF EXISTS "Adults can create visibility settings" ON public.member_visibility;
CREATE POLICY "Adults can create visibility settings"
  ON public.member_visibility FOR INSERT TO authenticated
  WITH CHECK (public.is_family_adult(family_id));

DROP POLICY IF EXISTS "Adults can update visibility settings" ON public.member_visibility;
CREATE POLICY "Adults can update visibility settings"
  ON public.member_visibility FOR UPDATE TO authenticated
  USING (public.is_family_adult(family_id))
  WITH CHECK (public.is_family_adult(family_id));

DROP POLICY IF EXISTS "Adults can delete visibility settings" ON public.member_visibility;
CREATE POLICY "Adults can delete visibility settings"
  ON public.member_visibility FOR DELETE TO authenticated
  USING (public.is_family_adult(family_id));

DROP TRIGGER IF EXISTS update_member_visibility_updated_at ON public.member_visibility;
CREATE TRIGGER update_member_visibility_updated_at
  BEFORE UPDATE ON public.member_visibility
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Event visibility rule (adults unchanged, children filtered)
CREATE OR REPLACE FUNCTION public.can_view_event(_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _family uuid;
  _my_member uuid;
  _mode text;
  _see_own boolean := true;
  _see_shared boolean := true;
  _allowed uuid[] := '{}';
  _links int;
  _members int;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;

  SELECT e.family_id INTO _family FROM public.family_events e WHERE e.id = _event_id;
  IF _family IS NULL THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_users WHERE family_id = _family AND user_id = _uid
  ) THEN
    RETURN false;
  END IF;

  -- Adults keep full access to their space.
  IF EXISTS (
    SELECT 1 FROM public.family_users
    WHERE family_id = _family AND user_id = _uid AND role IN ('owner', 'parent')
  ) THEN
    RETURN true;
  END IF;

  SELECT id INTO _my_member
  FROM public.family_members
  WHERE family_id = _family AND linked_user_id = _uid
  LIMIT 1;

  SELECT mode, see_own, see_shared, allowed_member_ids
    INTO _mode, _see_own, _see_shared, _allowed
  FROM public.member_visibility
  WHERE family_member_id = _my_member;

  _mode := coalesce(_mode, 'own_shared');
  IF _mode = 'all' THEN RETURN true; END IF;

  SELECT count(*) INTO _links FROM public.event_members WHERE event_id = _event_id;
  SELECT count(*) INTO _members FROM public.family_members WHERE family_id = _family;

  -- Own events
  IF _my_member IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.event_members
    WHERE event_id = _event_id AND family_member_id = _my_member
  ) THEN
    IF _mode = 'custom' THEN RETURN coalesce(_see_own, true); END IF;
    RETURN true;
  END IF;

  -- Shared events: nobody specific, or everyone in the space
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
$$;

-- Keep the existing helper name working, now visibility-aware.
CREATE OR REPLACE FUNCTION public.can_access_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_view_event(_event_id)
$$;

-- 5) Events: read/update/delete follow the visibility rule
DROP POLICY IF EXISTS "Members can view family events" ON public.family_events;
CREATE POLICY "Members can view family events"
  ON public.family_events FOR SELECT TO authenticated
  USING (public.can_view_event(id));

DROP POLICY IF EXISTS "Members can update family events" ON public.family_events;
CREATE POLICY "Members can update family events"
  ON public.family_events FOR UPDATE TO authenticated
  USING (public.can_view_event(id))
  WITH CHECK (public.is_family_member(family_id));

DROP POLICY IF EXISTS "Members can delete family events" ON public.family_events;
CREATE POLICY "Members can delete family events"
  ON public.family_events FOR DELETE TO authenticated
  USING (public.can_view_event(id));

-- 6) Member profiles: adults manage, connected people may rename themselves
DROP POLICY IF EXISTS "Members can add family members" ON public.family_members;
CREATE POLICY "Members can add family members"
  ON public.family_members FOR INSERT TO authenticated
  WITH CHECK (public.is_family_adult(family_id));

DROP POLICY IF EXISTS "Members can update family members" ON public.family_members;
CREATE POLICY "Members can update family members"
  ON public.family_members FOR UPDATE TO authenticated
  USING (public.is_family_adult(family_id) OR linked_user_id = auth.uid())
  WITH CHECK (public.is_family_adult(family_id) OR linked_user_id = auth.uid());

DROP POLICY IF EXISTS "Members can delete family members" ON public.family_members;
CREATE POLICY "Members can delete family members"
  ON public.family_members FOR DELETE TO authenticated
  USING (public.is_family_adult(family_id));

-- 7) Invitation acceptance: adults as before, children link to their existing profile
CREATE OR REPLACE FUNCTION public.accept_family_invitation()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _inv public.family_invitations%ROWTYPE;
  _name text;
  _role text;
  _member_id uuid;
BEGIN
  IF _uid IS NULL OR _email = '' THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.family_users WHERE user_id = _uid) THEN
    UPDATE public.family_invitations
      SET status = 'accepted', accepted_at = now()
      WHERE status = 'pending' AND lower(email) = _email
        AND family_id IN (SELECT family_id FROM public.family_users WHERE user_id = _uid);
    RETURN (SELECT family_id FROM public.family_users WHERE user_id = _uid LIMIT 1);
  END IF;

  SELECT * INTO _inv FROM public.family_invitations
    WHERE status = 'pending' AND lower(email) = _email
    ORDER BY created_at DESC LIMIT 1;

  IF _inv.id IS NULL THEN
    RETURN NULL;
  END IF;

  _role := coalesce(_inv.role, 'parent');
  IF _role NOT IN ('parent', 'child') THEN
    _role := 'parent';
  END IF;

  SELECT coalesce(nullif(trim(name), ''), '') INTO _name FROM public.profiles WHERE id = _uid;
  _name := coalesce(_name, '');

  INSERT INTO public.family_users (family_id, user_id, role)
  VALUES (_inv.family_id, _uid, _role);

  -- Prefer connecting to the person the invitation points at.
  IF _inv.family_member_id IS NOT NULL THEN
    SELECT id INTO _member_id
    FROM public.family_members
    WHERE id = _inv.family_member_id
      AND family_id = _inv.family_id
      AND (linked_user_id IS NULL OR linked_user_id = _uid)
    LIMIT 1;
  END IF;

  IF _member_id IS NULL THEN
    SELECT id INTO _member_id
    FROM public.family_members
    WHERE family_id = _inv.family_id AND linked_user_id = _uid
    LIMIT 1;
  END IF;

  IF _member_id IS NOT NULL THEN
    UPDATE public.family_members
      SET linked_user_id = _uid,
          member_type = CASE WHEN _role = 'child' THEN 'child' ELSE 'parent' END,
          name = CASE WHEN coalesce(trim(name), '') = '' THEN _name ELSE name END
      WHERE id = _member_id;
  ELSE
    INSERT INTO public.family_members (family_id, name, member_type, linked_user_id)
    VALUES (
      _inv.family_id,
      _name,
      CASE WHEN _role = 'child' THEN 'child' ELSE 'parent' END,
      _uid
    )
    RETURNING id INTO _member_id;
  END IF;

  IF _role = 'child' AND _member_id IS NOT NULL THEN
    INSERT INTO public.member_visibility (family_id, family_member_id, mode)
    VALUES (_inv.family_id, _member_id, 'own_shared')
    ON CONFLICT (family_member_id) DO NOTHING;
  END IF;

  UPDATE public.family_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = _inv.id;

  RETURN _inv.family_id;
END;
$$;