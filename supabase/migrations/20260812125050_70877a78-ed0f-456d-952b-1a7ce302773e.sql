ALTER TABLE public.family_users DROP CONSTRAINT IF EXISTS family_users_role_check;
ALTER TABLE public.family_users ADD CONSTRAINT family_users_role_check
  CHECK (role = ANY (ARRAY['owner'::text, 'parent'::text, 'child'::text]));