CREATE TABLE public.family_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text,
  date date,
  time time,
  location text,
  notes text,
  deadline date,
  amount text,
  things_to_bring jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_events TO authenticated;
GRANT ALL ON public.family_events TO service_role;

ALTER TABLE public.family_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view family events" ON public.family_events
  FOR SELECT TO authenticated USING (public.is_family_member(family_id));
CREATE POLICY "Members can create family events" ON public.family_events
  FOR INSERT TO authenticated WITH CHECK (public.is_family_member(family_id) AND created_by = auth.uid());
CREATE POLICY "Members can update family events" ON public.family_events
  FOR UPDATE TO authenticated USING (public.is_family_member(family_id)) WITH CHECK (public.is_family_member(family_id));
CREATE POLICY "Members can delete family events" ON public.family_events
  FOR DELETE TO authenticated USING (public.is_family_member(family_id));

CREATE INDEX family_events_family_id_date_idx ON public.family_events (family_id, date);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_family_events_updated_at
  BEFORE UPDATE ON public.family_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.event_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.family_events(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES public.family_members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, family_member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_members TO authenticated;
GRANT ALL ON public.event_members TO service_role;

ALTER TABLE public.event_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_events e
    JOIN public.family_users fu ON fu.family_id = e.family_id
    WHERE e.id = _event_id AND fu.user_id = auth.uid()
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_access_event(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_access_event(uuid) TO authenticated, service_role;

CREATE POLICY "Members can view event members" ON public.event_members
  FOR SELECT TO authenticated USING (public.can_access_event(event_id));
CREATE POLICY "Members can link event members" ON public.event_members
  FOR INSERT TO authenticated WITH CHECK (public.can_access_event(event_id));
CREATE POLICY "Members can update event members" ON public.event_members
  FOR UPDATE TO authenticated USING (public.can_access_event(event_id)) WITH CHECK (public.can_access_event(event_id));
CREATE POLICY "Members can unlink event members" ON public.event_members
  FOR DELETE TO authenticated USING (public.can_access_event(event_id));

CREATE INDEX event_members_event_id_idx ON public.event_members (event_id);
CREATE INDEX event_members_family_member_id_idx ON public.event_members (family_member_id);

ALTER TABLE public.family_events REPLICA IDENTITY FULL;
ALTER TABLE public.event_members REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_members;