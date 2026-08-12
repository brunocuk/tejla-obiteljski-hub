CREATE OR REPLACE FUNCTION public.create_family(_family_name text, _my_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _family_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Niste prijavljeni.';
  END IF;

  IF coalesce(trim(_family_name), '') = '' OR coalesce(trim(_my_name), '') = '' THEN
    RAISE EXCEPTION 'Naziv obitelji i ime su obavezni.';
  END IF;

  SELECT family_id INTO _family_id FROM public.family_users WHERE user_id = _uid LIMIT 1;
  IF _family_id IS NOT NULL THEN
    RETURN _family_id;
  END IF;

  INSERT INTO public.families (name, created_by)
  VALUES (trim(_family_name), _uid)
  RETURNING id INTO _family_id;

  INSERT INTO public.family_users (family_id, user_id, role)
  VALUES (_family_id, _uid, 'owner');

  INSERT INTO public.family_members (family_id, name, member_type, linked_user_id)
  VALUES (_family_id, trim(_my_name), 'parent', _uid);

  RETURN _family_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_family(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_family(text, text) TO authenticated;