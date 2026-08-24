ALTER TABLE public.account_deletion_requests ALTER COLUMN user_id DROP NOT NULL;

UPDATE public.account_deletion_requests
SET user_id = NULL, updated_at = now()
WHERE status = 'completed' AND user_id IS NOT NULL;