CREATE TABLE public.app_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_admins TO authenticated;
GRANT ALL ON public.app_admins TO service_role;
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can see admin list" ON public.app_admins FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid())
$$;

-- Napomena (selidba 2026-10): hardkodirani seed admina iz stare Lovable produkcije
-- je uklonjen jer taj UUID ne postoji u auth.users novog projekta (FK bi srusio
-- migraciju). Admin se dodaje rucno nakon registracije prvog korisnika:
--   INSERT INTO public.app_admins (user_id) VALUES ('<uuid>') ON CONFLICT DO NOTHING;

CREATE TABLE public.beta_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','revoked')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE ON public.beta_invites TO authenticated;
GRANT ALL ON public.beta_invites TO service_role;
ALTER TABLE public.beta_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "App admins can view beta invites" ON public.beta_invites FOR SELECT TO authenticated USING (public.is_app_admin());
CREATE POLICY "App admins can create beta invites" ON public.beta_invites FOR INSERT TO authenticated WITH CHECK (public.is_app_admin() AND created_by = auth.uid());
CREATE POLICY "App admins can update beta invites" ON public.beta_invites FOR UPDATE TO authenticated USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());

CREATE TRIGGER update_beta_invites_updated_at BEFORE UPDATE ON public.beta_invites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();