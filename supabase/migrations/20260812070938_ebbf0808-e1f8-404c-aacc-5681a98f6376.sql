REVOKE EXECUTE ON FUNCTION public.accept_family_invitation() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_family_owner(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.accept_family_invitation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_owner(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_family(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_family(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_family_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_family_member(uuid) TO authenticated;