CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.family_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'parent' CHECK (role IN ('owner','parent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_users TO authenticated;
GRANT ALL ON public.family_users TO service_role;
ALTER TABLE public.family_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  member_type text NOT NULL DEFAULT 'child' CHECK (member_type IN ('parent','child')),
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_family_member(_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_users
    WHERE family_id = _family_id AND user_id = auth.uid()
  )
$$;

CREATE POLICY "Members can view their family" ON public.families
  FOR SELECT TO authenticated USING (public.is_family_member(id));
CREATE POLICY "Users can create a family" ON public.families
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Members can update their family" ON public.families
  FOR UPDATE TO authenticated USING (public.is_family_member(id)) WITH CHECK (public.is_family_member(id));

CREATE POLICY "Members can view family users" ON public.family_users
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_family_member(family_id));
CREATE POLICY "Users can join a family they create" ON public.family_users
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND (
      public.is_family_member(family_id)
      OR EXISTS (SELECT 1 FROM public.families f WHERE f.id = family_id AND f.created_by = auth.uid())
    )
  );

CREATE POLICY "Members can view family members" ON public.family_members
  FOR SELECT TO authenticated USING (public.is_family_member(family_id));
CREATE POLICY "Members can add family members" ON public.family_members
  FOR INSERT TO authenticated WITH CHECK (public.is_family_member(family_id));
CREATE POLICY "Members can update family members" ON public.family_members
  FOR UPDATE TO authenticated USING (public.is_family_member(family_id)) WITH CHECK (public.is_family_member(family_id));
CREATE POLICY "Members can delete family members" ON public.family_members
  FOR DELETE TO authenticated USING (public.is_family_member(family_id));