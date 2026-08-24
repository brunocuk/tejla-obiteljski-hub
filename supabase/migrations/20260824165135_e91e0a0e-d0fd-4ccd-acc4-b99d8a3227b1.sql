-- 1. Child edit rights: only what the child created.
CREATE OR REPLACE FUNCTION public.can_edit_event_row(_event_id uuid, _family_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _created_by uuid;
BEGIN
  IF _uid IS NULL OR _family_id IS NULL THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_users WHERE family_id = _family_id AND user_id = _uid
  ) THEN
    RETURN false;
  END IF;

  -- Adults keep exactly the previous behaviour.
  IF public.is_family_adult(_family_id) THEN
    RETURN public.can_view_event_row(_event_id, _family_id);
  END IF;

  -- Children may only manage what they created themselves.
  IF NOT public.can_view_event_row(_event_id, _family_id) THEN RETURN false; END IF;

  SELECT created_by INTO _created_by FROM public.family_events WHERE id = _event_id;
  RETURN _created_by = _uid;
END;
$function$;

-- 2. Narrow extra right: a child may flip completion on a task assigned to them.
CREATE OR REPLACE FUNCTION public.can_toggle_event_row(_event_id uuid, _family_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _my_member uuid;
BEGIN
  IF _uid IS NULL OR _family_id IS NULL THEN RETURN false; END IF;
  IF public.is_family_adult(_family_id) THEN RETURN true; END IF;
  IF NOT public.can_view_event_row(_event_id, _family_id) THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_events
    WHERE id = _event_id AND family_id = _family_id AND type = 'task'
  ) THEN
    RETURN false;
  END IF;

  SELECT id INTO _my_member FROM public.family_members
  WHERE family_id = _family_id AND linked_user_id = _uid LIMIT 1;
  IF _my_member IS NULL THEN RETURN false; END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.event_members
    WHERE event_id = _event_id AND family_member_id = _my_member
  );
END;
$function$;

DROP POLICY IF EXISTS "Members can update family events" ON public.family_events;
CREATE POLICY "Members can update family events" ON public.family_events
FOR UPDATE
USING (
  public.can_edit_event_row(id, family_id)
  OR public.can_toggle_event_row(id, family_id)
)
WITH CHECK (
  public.is_family_member(family_id)
  AND (
    public.can_edit_event_row(id, family_id)
    OR public.can_toggle_event_row(id, family_id)
  )
);

-- 3. Field-level guard: on someone else's obligation a child may only change completion.
CREATE OR REPLACE FUNCTION public.guard_family_event_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('tejla.account_deletion', true) = '1' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.is_family_adult(OLD.family_id) THEN RETURN NEW; END IF;
  IF OLD.created_by = auth.uid() THEN RETURN NEW; END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.date IS DISTINCT FROM OLD.date
     OR NEW.time IS DISTINCT FROM OLD.time
     OR NEW.location IS DISTINCT FROM OLD.location
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.deadline IS DISTINCT FROM OLD.deadline
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.things_to_bring IS DISTINCT FROM OLD.things_to_bring
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.linked_event_id IS DISTINCT FROM OLD.linked_event_id
     OR NEW.family_id IS DISTINCT FROM OLD.family_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Ovu obavezu je unijela odrasla osoba, pa možeš promijeniti samo je li riješena.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_family_event_update ON public.family_events;
CREATE TRIGGER guard_family_event_update
BEFORE UPDATE ON public.family_events
FOR EACH ROW EXECUTE FUNCTION public.guard_family_event_update();

-- 4. A child may only put themselves on an obligation.
CREATE OR REPLACE FUNCTION public.guard_event_member_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.event_members%ROWTYPE;
  _family uuid;
  _created_by uuid;
  _my_member uuid;
BEGIN
  IF current_setting('tejla.account_deletion', true) = '1' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF _uid IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  _row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  SELECT family_id, created_by INTO _family, _created_by
  FROM public.family_events WHERE id = _row.event_id;

  IF _family IS NULL OR public.is_family_adult(_family) THEN RETURN _row; END IF;

  SELECT id INTO _my_member FROM public.family_members
  WHERE family_id = _family AND linked_user_id = _uid LIMIT 1;

  IF _row.family_member_id = _my_member THEN RETURN _row; END IF;

  -- Cleaning up an obligation the child created themselves stays allowed.
  IF TG_OP = 'DELETE' AND _created_by = _uid THEN RETURN _row; END IF;

  RAISE EXCEPTION 'Obavezu možeš dodijeliti samo sebi.';
END;
$function$;

DROP TRIGGER IF EXISTS guard_event_member_write ON public.event_members;
CREATE TRIGGER guard_event_member_write
BEFORE INSERT OR UPDATE OR DELETE ON public.event_members
FOR EACH ROW EXECUTE FUNCTION public.guard_event_member_write();

-- 5. A child's reminder may only reach the child.
CREATE OR REPLACE FUNCTION public.guard_event_reminder_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _family uuid;
  _recipients uuid[] := coalesce(NEW.recipient_user_ids, '{}'::uuid[]);
BEGIN
  IF current_setting('tejla.account_deletion', true) = '1' THEN RETURN NEW; END IF;
  IF _uid IS NULL THEN RETURN NEW; END IF;

  SELECT family_id INTO _family FROM public.family_events WHERE id = NEW.event_id;
  IF _family IS NULL OR public.is_family_adult(_family) THEN RETURN NEW; END IF;

  IF NEW.recipient_mode = 'all_parents' THEN
    RAISE EXCEPTION 'Podsjetnik možeš postaviti samo sebi.';
  END IF;

  IF EXISTS (SELECT 1 FROM unnest(_recipients) AS r(id) WHERE r.id IS DISTINCT FROM _uid) THEN
    RAISE EXCEPTION 'Podsjetnik možeš postaviti samo sebi.';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS guard_event_reminder_write ON public.event_reminders;
CREATE TRIGGER guard_event_reminder_write
BEFORE INSERT OR UPDATE ON public.event_reminders
FOR EACH ROW EXECUTE FUNCTION public.guard_event_reminder_write();