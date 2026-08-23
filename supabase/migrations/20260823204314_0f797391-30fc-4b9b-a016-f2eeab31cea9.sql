REVOKE EXECUTE ON FUNCTION public.account_deletion_preview() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_my_account(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.account_deletion_preview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account(uuid) TO authenticated;