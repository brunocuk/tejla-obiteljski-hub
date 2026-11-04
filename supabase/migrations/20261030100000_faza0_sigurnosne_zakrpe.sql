-- ============================================================
-- Faza 0 sigurnosne zakrpe (nalazi S1, S2, S3 iz izvjestaja 29.9.2026.)
-- Primjenjuje se pri podizanju sheme na novi Supabase projekt.
-- ============================================================

-- ------------------------------------------------------------
-- S1: family_id na family_members je nepromjenjiv.
-- UPDATE policy je dopustala da odrasla osoba obitelji A premjesti
-- clana u tudju obitelj B (family_id = B, linked_user_id = auth.uid()).
-- Guard trigger sada odbija svaku promjenu family_id za korisnicke
-- sesije; service role bez auth konteksta i tok brisanja racuna
-- (GUC tejla.account_deletion) prolaze kao i kod ostalih guardova.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_family_member_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('tejla.account_deletion', true) = '1' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  -- S1: clan se ne moze premjestiti u drugu obitelj, ni kao odrasla osoba
  IF NEW.family_id IS DISTINCT FROM OLD.family_id THEN
    RAISE EXCEPTION 'Nemaš ovlasti za promjenu ovih podataka.';
  END IF;

  IF public.is_family_adult(OLD.family_id) THEN RETURN NEW; END IF;

  IF NEW.member_type IS DISTINCT FROM OLD.member_type
     OR NEW.linked_user_id IS DISTINCT FROM OLD.linked_user_id
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Nemaš ovlasti za promjenu ovih podataka.';
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- S2: member_visibility red mora pokazivati na clana ISTE obitelji.
-- Dosadasnji WITH CHECK je provjeravao samo is_family_adult(family_id),
-- pa je odrasla osoba obitelji A mogla podmetnuti red koji upravlja
-- vidljivoscu clana obitelji B (a roditelji B ga ne mogu ispraviti).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Adults can create visibility settings" ON public.member_visibility;
CREATE POLICY "Adults can create visibility settings"
  ON public.member_visibility FOR INSERT TO authenticated
  WITH CHECK (
    public.is_family_adult(family_id)
    AND EXISTS (
      SELECT 1 FROM public.family_members m
      WHERE m.id = member_visibility.family_member_id
        AND m.family_id = member_visibility.family_id
    )
  );

DROP POLICY IF EXISTS "Adults can update visibility settings" ON public.member_visibility;
CREATE POLICY "Adults can update visibility settings"
  ON public.member_visibility FOR UPDATE TO authenticated
  USING (public.is_family_adult(family_id))
  WITH CHECK (
    public.is_family_adult(family_id)
    AND EXISTS (
      SELECT 1 FROM public.family_members m
      WHERE m.id = member_visibility.family_member_id
        AND m.family_id = member_visibility.family_id
    )
  );

-- ------------------------------------------------------------
-- S3: integritet event_reminders.
--  a) created_by je nakon inserta nepromjenjiv (UPDATE policy ga nije stitila).
--  b) recipient_user_ids smije sadrzavati samo clanove obitelji eventa
--     (dosad je validacija postojala samo u cron jobu pri slanju).
-- Provjera primatelja se radi samo kad se lista mijenja, pa cron update
-- sent_at polja i dalje prolazi bez troska; tok brisanja racuna (GUC)
-- prolazi jer nakon uklanjanja clana lista moze sadrzavati povijesne idjeve.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_event_reminder_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _family uuid;
  _check_recipients boolean := true;
BEGIN
  IF current_setting('tejla.account_deletion', true) = '1' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'Autor podsjetnika se ne može mijenjati.';
    END IF;
    _check_recipients := NEW.recipient_user_ids IS DISTINCT FROM OLD.recipient_user_ids;
  END IF;

  IF _check_recipients THEN
    SELECT family_id INTO _family FROM public.family_events WHERE id = NEW.event_id;
    IF _family IS NOT NULL AND EXISTS (
      SELECT 1 FROM unnest(coalesce(NEW.recipient_user_ids, '{}'::uuid[])) AS r(id)
      WHERE NOT EXISTS (
        SELECT 1 FROM public.family_users fu
        WHERE fu.family_id = _family AND fu.user_id = r.id
      )
    ) THEN
      RAISE EXCEPTION 'Primatelji podsjetnika moraju biti članovi obitelji.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_event_reminder_integrity ON public.event_reminders;
CREATE TRIGGER guard_event_reminder_integrity
  BEFORE INSERT OR UPDATE ON public.event_reminders
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_reminder_integrity();
