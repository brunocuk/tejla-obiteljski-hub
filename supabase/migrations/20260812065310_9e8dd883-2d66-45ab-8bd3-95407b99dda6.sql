REVOKE EXECUTE ON FUNCTION public.is_family_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_family_member(uuid) TO authenticated, service_role;