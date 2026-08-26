DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sandbox_exec') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.expand_event_occurrences(uuid, date, date) TO sandbox_exec';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.expand_family_occurrences(uuid, date, date) TO sandbox_exec';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.materialize_reminder_occurrences(integer) TO sandbox_exec';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_due_reminder_occurrences(integer) TO sandbox_exec';
  END IF;
END $$;