-- ============================================================
-- FAZA 1: deterministic Croatian public holidays
-- ============================================================
CREATE OR REPLACE FUNCTION public.hr_easter_sunday(_year integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  a int; b int; c int; d int; e int; f int; g int; h int;
  i int; k int; l int; m int; mth int; dy int;
BEGIN
  a := _year % 19;
  b := _year / 100;
  c := _year % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  mth := (h + l - 7 * m + 114) / 31;
  dy := ((h + l - 7 * m + 114) % 31) + 1;
  RETURN make_date(_year, mth, dy);
END;
$function$;

CREATE OR REPLACE FUNCTION public.hr_public_holiday(_year integer)
RETURNS TABLE (day date, name text)
LANGUAGE sql
IMMUTABLE
AS $function$
  WITH easter AS (SELECT public.hr_easter_sunday(_year) AS e)
  SELECT d, n FROM (
    VALUES
      (make_date(_year,  1,  1), 'Nova godina'),
      (make_date(_year,  1,  6), 'Bogojavljenje / Sveta tri kralja'),
      (make_date(_year,  5,  1), 'Praznik rada'),
      (make_date(_year,  5, 30), 'Dan državnosti'),
      (make_date(_year,  6, 22), 'Dan antifašističke borbe'),
      (make_date(_year,  8,  5), 'Dan pobjede i domovinske zahvalnosti'),
      (make_date(_year,  8, 15), 'Velika Gospa'),
      (make_date(_year, 11,  1), 'Svi sveti'),
      (make_date(_year, 11, 18), 'Dan sjećanja na žrtve Domovinskog rata'),
      (make_date(_year, 12, 25), 'Božić'),
      (make_date(_year, 12, 26), 'Sveti Stjepan')
  ) AS fixed(d, n)
  UNION ALL
  SELECT e, 'Uskrs' FROM easter
  UNION ALL
  SELECT e + 1, 'Uskrsni ponedjeljak' FROM easter
  UNION ALL
  SELECT e + 60, 'Tijelovo' FROM easter
  ORDER BY 1
$function$;

REVOKE ALL ON FUNCTION public.hr_easter_sunday(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hr_public_holiday(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hr_easter_sunday(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hr_public_holiday(integer) TO authenticated, service_role;

-- ============================================================
-- FAZA 2: official school calendars (versioned per school year)
-- ============================================================
CREATE TABLE public.school_calendars (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL DEFAULT 'HR',
  school_year text NOT NULL,
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  source_url text,
  published_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_calendars_year_format CHECK (school_year ~ '^\d{4}/\d{4}$'),
  CONSTRAINT school_calendars_range CHECK (valid_to >= valid_from),
  CONSTRAINT school_calendars_unique_year UNIQUE (scope, school_year)
);

GRANT SELECT ON public.school_calendars TO authenticated;
GRANT ALL ON public.school_calendars TO service_role;
ALTER TABLE public.school_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prijavljeni mogu citati skolske kalendare"
  ON public.school_calendars FOR SELECT TO authenticated USING (true);
CREATE POLICY "Administratori upisuju skolske kalendare"
  ON public.school_calendars FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Administratori mijenjaju skolske kalendare"
  ON public.school_calendars FOR UPDATE TO authenticated
  USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Administratori brisu skolske kalendare"
  ON public.school_calendars FOR DELETE TO authenticated USING (public.is_app_admin());

CREATE TRIGGER update_school_calendars_updated_at
  BEFORE UPDATE ON public.school_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.school_breaks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  calendar_id uuid NOT NULL REFERENCES public.school_calendars(id) ON DELETE CASCADE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_breaks_range CHECK (ends_on >= starts_on)
);

CREATE INDEX school_breaks_calendar_idx ON public.school_breaks (calendar_id);
CREATE INDEX school_breaks_span_idx ON public.school_breaks (starts_on, ends_on);

GRANT SELECT ON public.school_breaks TO authenticated;
GRANT ALL ON public.school_breaks TO service_role;
ALTER TABLE public.school_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prijavljeni mogu citati skolske odmore"
  ON public.school_breaks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Administratori upisuju skolske odmore"
  ON public.school_breaks FOR INSERT TO authenticated WITH CHECK (public.is_app_admin());
CREATE POLICY "Administratori mijenjaju skolske odmore"
  ON public.school_breaks FOR UPDATE TO authenticated
  USING (public.is_app_admin()) WITH CHECK (public.is_app_admin());
CREATE POLICY "Administratori brisu skolske odmore"
  ON public.school_breaks FOR DELETE TO authenticated USING (public.is_app_admin());

CREATE TRIGGER update_school_breaks_updated_at
  BEFORE UPDATE ON public.school_breaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- FAZA 3: exclusion probe + coverage status
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_excluded_hr(_day date, _kinds text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    _day IS NOT NULL
    AND coalesce(array_length(_kinds, 1), 0) > 0
    AND (
      ('weekends' = ANY(_kinds) AND extract(isodow FROM _day)::int >= 6)
      OR (
        'public_holidays_hr' = ANY(_kinds)
        AND EXISTS (
          SELECT 1 FROM public.hr_public_holiday(extract(year FROM _day)::int) h
          WHERE h.day = _day
        )
      )
      OR (
        'school_breaks_hr' = ANY(_kinds)
        AND EXISTS (
          SELECT 1
          FROM public.school_breaks b
          JOIN public.school_calendars c ON c.id = b.calendar_id
          WHERE c.scope = 'HR'
            AND _day BETWEEN b.starts_on AND b.ends_on
        )
      )
    )
$function$;

-- Which school years in a window have an official calendar, and which do not.
-- Fail-open contract: a missing calendar never hides an occurrence, it only
-- reports a gap so the UI can show a discreet warning.
CREATE OR REPLACE FUNCTION public.school_calendar_coverage(_from date, _to date)
RETURNS TABLE (school_year text, covered boolean, gap_from date, gap_to date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH bounds AS (
    SELECT LEAST(_from, _to) AS lo, GREATEST(_from, _to) AS hi
  ), years AS (
    SELECT gs AS start_year
    FROM bounds,
         generate_series(
           CASE WHEN extract(month FROM bounds.lo)::int >= 9
                THEN extract(year FROM bounds.lo)::int
                ELSE extract(year FROM bounds.lo)::int - 1 END,
           CASE WHEN extract(month FROM bounds.hi)::int >= 9
                THEN extract(year FROM bounds.hi)::int
                ELSE extract(year FROM bounds.hi)::int - 1 END
         ) AS gs
  ), spans AS (
    SELECT
      (y.start_year::text || '/' || (y.start_year + 1)::text) AS sy,
      make_date(y.start_year, 9, 1) AS sy_from,
      make_date(y.start_year + 1, 8, 31) AS sy_to
    FROM years y
  )
  SELECT
    s.sy,
    EXISTS (
      SELECT 1 FROM public.school_calendars c
      WHERE c.scope = 'HR' AND c.school_year = s.sy
    ) AS covered,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.school_calendars c
      WHERE c.scope = 'HR' AND c.school_year = s.sy
    ) THEN NULL ELSE GREATEST(s.sy_from, (SELECT lo FROM bounds)) END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.school_calendars c
      WHERE c.scope = 'HR' AND c.school_year = s.sy
    ) THEN NULL ELSE LEAST(s.sy_to, (SELECT hi FROM bounds)) END
  FROM spans s
  ORDER BY s.sy_from
$function$;

REVOKE ALL ON FUNCTION public.is_excluded_hr(date, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.school_calendar_coverage(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_excluded_hr(date, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.school_calendar_coverage(date, date) TO authenticated, service_role;

-- ============================================================
-- FAZA 4: exclusion field on the series + child guard
-- ============================================================
ALTER TABLE public.family_events
  ADD COLUMN recurrence_exclude text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.family_events
  ADD CONSTRAINT family_events_recurrence_exclude_valid
  CHECK (
    recurrence_exclude <@ ARRAY['public_holidays_hr','school_breaks_hr','weekends']::text[]
    AND coalesce(array_ndims(recurrence_exclude), 1) = 1
    AND coalesce(array_length(recurrence_exclude, 1), 0) <= 3
  );

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
     OR NEW.end_time IS DISTINCT FROM OLD.end_time
     OR NEW.location IS DISTINCT FROM OLD.location
     OR NEW.notes IS DISTINCT FROM OLD.notes
     OR NEW.category IS DISTINCT FROM OLD.category
     OR NEW.deadline IS DISTINCT FROM OLD.deadline
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.things_to_bring IS DISTINCT FROM OLD.things_to_bring
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.linked_event_id IS DISTINCT FROM OLD.linked_event_id
     OR NEW.family_id IS DISTINCT FROM OLD.family_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.recurrence_freq IS DISTINCT FROM OLD.recurrence_freq
     OR NEW.recurrence_interval IS DISTINCT FROM OLD.recurrence_interval
     OR NEW.recurrence_byday IS DISTINCT FROM OLD.recurrence_byday
     OR NEW.recurrence_until IS DISTINCT FROM OLD.recurrence_until
     OR NEW.recurrence_note IS DISTINCT FROM OLD.recurrence_note
     OR NEW.recurrence_exclude IS DISTINCT FROM OLD.recurrence_exclude THEN
    RAISE EXCEPTION 'Ovu obavezu je unijela odrasla osoba, pa možeš promijeniti samo je li riješena.';
  END IF;

  RETURN NEW;
END;
$function$;