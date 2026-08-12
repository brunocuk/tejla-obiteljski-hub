CREATE OR REPLACE FUNCTION public.accept_family_invitation()
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

  SELECT coalesce(nullif(trim(name), ''), '') INTO _name FROM public.profiles WHERE id = _uid;
  _name := coalesce(_name, '');

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
$function$;