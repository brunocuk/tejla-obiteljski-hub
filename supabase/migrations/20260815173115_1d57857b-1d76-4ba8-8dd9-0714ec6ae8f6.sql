CREATE OR REPLACE FUNCTION public.accept_family_invitation(_invitation_id uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF _invitation_id IS NOT NULL THEN
    -- The client may only point at an invitation; the server re-verifies
    -- ownership (same e-mail) and that it is still pending.
    SELECT * INTO _inv FROM public.family_invitations
      WHERE id = _invitation_id
        AND status = 'pending'
        AND lower(email) = _email;
  ELSE
    SELECT * INTO _inv FROM public.family_invitations
      WHERE status = 'pending' AND lower(email) = _email
      ORDER BY created_at DESC LIMIT 1;
  END IF;

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
$function$;
