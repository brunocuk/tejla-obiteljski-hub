DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cleanup_reminder_occurrences(integer) TO sandbox_exec';
    EXECUTE 'GRANT UPDATE ON public.family_events TO sandbox_exec';
    EXECUTE 'GRANT UPDATE, INSERT, DELETE ON public.reminder_occurrences TO sandbox_exec';
  END IF;
END $$;
