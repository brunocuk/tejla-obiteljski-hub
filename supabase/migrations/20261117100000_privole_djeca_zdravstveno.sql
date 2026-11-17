-- Privole za javnu Tejlu (Matejin mail "PRIVOLE", 16.11.2026.):
--  1) djecji racun na pozivnicu s dobnom skupinom (10-15 roditelj daje privolu
--     prije aktivacije, 16-17 dijete samo potvrdjuje pri aktivaciji),
--  2) izricita privola za spremanje zdravstvenih termina (po clanu),
--  3) izricita privola za AI izdvajanje zdravstvenog termina (po clanu),
--  4) Tejline poruke (opt-in po korisniku).
-- Evidencija: tko je dao/povukao, za koga, za koju svrhu, kada i uz koju
-- verziju teksta; vezano na postojece identifikatore clana i prostora.
-- Varijanta A iz maila: dobne skupine bez datuma rodjenja; prelazak na 16+
-- samoizjavom ("Navrsio/la sam 16 godina") u djetetovim postavkama.

-- 1) Dobna skupina na pozivnici i clanu (bez datuma rodjenja, namjerno)
ALTER TABLE public.family_invitations
  ADD COLUMN IF NOT EXISTS age_group text
    CHECK (age_group IN ('10-15', '16-17'));

ALTER TABLE public.family_members
  ADD COLUMN IF NOT EXISTS age_group text
    CHECK (age_group IN ('10-15', '16-17')),
  ADD COLUMN IF NOT EXISTS sixteen_confirmed_at timestamptz;

-- 2) Oznaka zdravstvenog termina
ALTER TABLE public.family_events
  ADD COLUMN IF NOT EXISTS is_health boolean NOT NULL DEFAULT false;

-- 3) Evidencija privola. Svaka dana privola je novi red; povlacenje puni
--    revoked_at/revoked_by (povijest se cuva). Pise iskljucivo server
--    (service_role) kroz server funkcije koje provjeravaju tko smije dati
--    ili povuci privolu; klijent samo cita.
CREATE TABLE public.member_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- subjekt: clan prostora (zdravstvene privole, djecji racun) ...
  family_id uuid REFERENCES public.families(id) ON DELETE CASCADE,
  family_member_id uuid REFERENCES public.family_members(id) ON DELETE CASCADE,
  -- ... ili sam korisnik (Tejline poruke, bez prostora)
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN (
    'djecji-racun',
    'zdravstveno-spremanje',
    'zdravstveno-ai',
    'tejline-poruke'
  )),
  text_version text NOT NULL,
  -- ON DELETE SET NULL namjerno: brisanje racuna davatelja ne smije obrisati
  -- evidenciju privole drugog subjekta
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_via text NOT NULL CHECK (granted_via IN (
    'pozivnica', 'aktivacija-racuna', 'postavke', 'onboarding'
  )),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT member_consents_subject CHECK (
    (family_member_id IS NOT NULL AND family_id IS NOT NULL)
    OR subject_user_id IS NOT NULL
  )
);

-- najvise jedna AKTIVNA privola po subjektu i svrsi
CREATE UNIQUE INDEX member_consents_active_member
  ON public.member_consents (family_member_id, purpose)
  WHERE revoked_at IS NULL AND family_member_id IS NOT NULL;
CREATE UNIQUE INDEX member_consents_active_user
  ON public.member_consents (subject_user_id, purpose)
  WHERE revoked_at IS NULL AND family_member_id IS NULL AND subject_user_id IS NOT NULL;
CREATE INDEX member_consents_family ON public.member_consents (family_id);

GRANT SELECT ON public.member_consents TO authenticated;
GRANT ALL ON public.member_consents TO service_role;
ALTER TABLE public.member_consents ENABLE ROW LEVEL SECURITY;

-- Clanovi prostora vide privole svog prostora (potrebno za prikaz stanja
-- prekidaca i poruka u aplikaciji); korisnik vidi i svoje osobne zapise.
CREATE POLICY "Members can view family consents"
  ON public.member_consents FOR SELECT TO authenticated
  USING (
    (family_id IS NOT NULL AND public.is_family_member(family_id))
    OR subject_user_id = auth.uid()
    OR granted_by = auth.uid()
  );

-- 4) Provjera aktivne privole za RLS i RPC-ove
CREATE OR REPLACE FUNCTION public.has_active_consent(_family_member_id uuid, _purpose text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_consents
    WHERE family_member_id = _family_member_id
      AND purpose = _purpose
      AND revoked_at IS NULL
  )
$$;
REVOKE ALL ON FUNCTION public.has_active_consent(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_consent(uuid, text) TO authenticated, service_role;

-- 5) Zdravstveni termin bez aktivne privole clana ne smije u bazu.
--    RESTRICTIVE: vrijedi povrh postojecih policyja. Dodavanje osobe na
--    zdravstveni event trazi privolu te osobe za spremanje.
CREATE POLICY "Health events require member consent"
  ON public.event_members AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.family_events e
      WHERE e.id = event_id AND e.is_health
    )
    OR public.has_active_consent(family_member_id, 'zdravstveno-spremanje')
  );

-- Naknadno oznacavanje postojeceg eventa kao zdravstvenog trazi privolu svih
-- vec dodanih osoba (klijent to i ne nudi, ovo je brana na razini baze).
CREATE POLICY "Health flag requires member consent"
  ON public.family_events AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (
    NOT is_health
    OR NOT EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = family_events.id
        AND NOT public.has_active_consent(em.family_member_id, 'zdravstveno-spremanje')
    )
  );

-- 6) Prihvat pozivnice prenosi dobnu skupinu na clana (djecji racuni).
CREATE OR REPLACE FUNCTION public.accept_family_invitation(_invitation_id uuid DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _inv public.family_invitations%ROWTYPE;
  _name text;
  _role text;
  _member_id uuid;
BEGIN
  IF _uid IS NULL OR _email = '' THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.family_users WHERE user_id = _uid) THEN
    UPDATE public.family_invitations
      SET status = 'accepted', accepted_at = now()
      WHERE status = 'pending' AND lower(email) = _email
        AND family_id IN (SELECT family_id FROM public.family_users WHERE user_id = _uid);
    RETURN (SELECT family_id FROM public.family_users WHERE user_id = _uid LIMIT 1);
  END IF;

  IF _invitation_id IS NOT NULL THEN
    -- The client may only point at an invitation; the server re-verifies
    -- ownership (same e-mail) and that it is still pending.
    SELECT * INTO _inv FROM public.family_invitations
      WHERE id = _invitation_id
        AND status = 'pending'
        AND lower(email) = _email;
  ELSE
    SELECT * INTO _inv FROM public.family_invitations
      WHERE status = 'pending' AND lower(email) = _email
      ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF _inv.id IS NULL THEN
    RETURN NULL;
  END IF;

  _role := coalesce(_inv.role, 'parent');
  IF _role NOT IN ('parent', 'child') THEN
    _role := 'parent';
  END IF;

  SELECT coalesce(nullif(trim(name), ''), '') INTO _name FROM public.profiles WHERE id = _uid;
  _name := coalesce(_name, '');

  INSERT INTO public.family_users (family_id, user_id, role)
  VALUES (_inv.family_id, _uid, _role);

  IF _inv.family_member_id IS NOT NULL THEN
    SELECT id INTO _member_id
    FROM public.family_members
    WHERE id = _inv.family_member_id
      AND family_id = _inv.family_id
      AND (linked_user_id IS NULL OR linked_user_id = _uid)
    LIMIT 1;
  END IF;

  IF _member_id IS NULL THEN
    SELECT id INTO _member_id
    FROM public.family_members
    WHERE family_id = _inv.family_id AND linked_user_id = _uid
    LIMIT 1;
  END IF;

  IF _member_id IS NOT NULL THEN
    UPDATE public.family_members
      SET linked_user_id = _uid,
          member_type = CASE WHEN _role = 'child' THEN 'child' ELSE 'parent' END,
          name = CASE WHEN coalesce(trim(name), '') = '' THEN _name ELSE name END,
          age_group = CASE
            WHEN _role = 'child' AND _inv.age_group IS NOT NULL THEN _inv.age_group
            ELSE age_group
          END
      WHERE id = _member_id;
  ELSE
    INSERT INTO public.family_members (family_id, name, member_type, linked_user_id, age_group)
    VALUES (
      _inv.family_id,
      _name,
      CASE WHEN _role = 'child' THEN 'child' ELSE 'parent' END,
      _uid,
      CASE WHEN _role = 'child' THEN _inv.age_group ELSE NULL END
    )
    RETURNING id INTO _member_id;
  END IF;

  IF _role = 'child' AND _member_id IS NOT NULL THEN
    INSERT INTO public.member_visibility (family_id, family_member_id, mode)
    VALUES (_inv.family_id, _member_id, 'own_shared')
    ON CONFLICT (family_member_id) DO NOTHING;
  END IF;

  UPDATE public.family_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = _inv.id;

  RETURN _inv.family_id;
END;
$function$;
