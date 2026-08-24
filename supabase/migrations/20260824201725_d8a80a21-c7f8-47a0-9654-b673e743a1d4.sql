-- 1) family_events UPDATE policy: restrict to authenticated, same expressions
DROP POLICY IF EXISTS "Members can update family events" ON public.family_events;
CREATE POLICY "Members can update family events"
  ON public.family_events
  FOR UPDATE
  TO authenticated
  USING (public.can_edit_event_row(id, family_id) OR public.can_toggle_event_row(id, family_id))
  WITH CHECK (public.can_edit_event_row(id, family_id) OR public.can_toggle_event_row(id, family_id));

-- 2) Revoke anon/PUBLIC EXECUTE where not needed
REVOKE EXECUTE ON FUNCTION public.accept_family_invitation(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.accept_family_invitation() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pending_family_invitation() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_family_adult(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_family_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_family_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_event_row(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_event_row(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_toggle_event_row(uuid, uuid) FROM PUBLIC, anon;

-- keep authenticated EXECUTE where RLS/client needs it
GRANT EXECUTE ON FUNCTION public.accept_family_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pending_family_invitation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_adult(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_family_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_event_row(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_event_row(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_toggle_event_row(uuid, uuid) TO authenticated;

-- 3) Trigger functions: no direct EXECUTE for PUBLIC/anon/authenticated
REVOKE EXECUTE ON FUNCTION public.guard_event_member_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_event_reminder_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_family_event_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_family_member_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 4) Unused wrappers
REVOKE EXECUTE ON FUNCTION public.can_access_event(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_edit_event(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_event(uuid) FROM PUBLIC, anon, authenticated;
