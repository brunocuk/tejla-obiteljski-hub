CREATE TABLE public.family_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'parent',
  status text NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

ALTER TABLE public.family_invitations
  ADD CONSTRAINT family_invitations_status_check
  CHECK (status IN ('pending','accepted','cancelled'));

CREATE UNIQUE INDEX family_invitations_pending_unique
  ON public.family_invitations (family_id, lower(email))
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.family_invitations TO authenticated;
GRANT ALL ON public.family_invitations TO service_role;

ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_family_owner(_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_users
    WHERE family_id = _family_id AND user_id = auth.uid() AND role = 'owner'
  )
$$;

CREATE POLICY "Members can view family invitations"
ON public.family_invitations FOR SELECT TO authenticated
USING (public.is_family_member(family_id));

CREATE POLICY "Owners can create invitations"
ON public.family_invitations FOR INSERT TO authenticated
WITH CHECK (public.is_family_owner(family_id) AND invited_by = auth.uid());

CREATE POLICY "Owners can cancel invitations"
ON public.family_invitations FOR UPDATE TO authenticated
USING (public.is_family_owner(family_id))
WITH CHECK (public.is_family_owner(family_id));

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

  SELECT nullif(trim(name), '') INTO _name FROM public.profiles WHERE id = _uid;
  IF _name IS NULL THEN
    _name := split_part(_email, '@', 1);
  END IF;

  INSERT INTO public.family_users (family_id, user_id, role)
  VALUES (_inv.family_id, _uid, coalesce(_inv.role, 'parent'));

  IF EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = _inv.family_id AND linked_user_id = _uid
  ) THEN
    UPDATE public.family_members
      SET member_type = 'parent', name = _name
      WHERE family_id = _inv.family_id AND linked_user_id = _uid;
  ELSE
    INSERT INTO public.family_members (family_id, name, member_type, linked_user_id)
    VALUES (_inv.family_id, _name, 'parent', _uid);
  END IF;

  UPDATE public.family_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = _inv.id;

  RETURN _inv.family_id;
END;
$$;