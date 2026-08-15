CREATE OR REPLACE FUNCTION public.pending_family_invitation()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _inv public.family_invitations%ROWTYPE;
  _family_name text;
BEGIN
  IF _uid IS NULL OR _email = '' THEN
    RETURN NULL;
  END IF;

  -- Users who already belong to a space are never prompted.
  IF EXISTS (SELECT 1 FROM public.family_users WHERE user_id = _uid) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _inv
  FROM public.family_invitations
  WHERE status = 'pending' AND lower(email) = _email
  ORDER BY created_at DESC
  LIMIT 1;

  IF _inv.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT name INTO _family_name FROM public.families WHERE id = _inv.family_id;

  RETURN jsonb_build_object(
    'id', _inv.id,
    'family_id', _inv.family_id,
    'family_name', coalesce(nullif(trim(_family_name), ''), 'Obiteljski prostor'),
    'role', coalesce(_inv.role, 'parent')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.pending_family_invitation() FROM anon;
GRANT EXECUTE ON FUNCTION public.pending_family_invitation() TO authenticated;