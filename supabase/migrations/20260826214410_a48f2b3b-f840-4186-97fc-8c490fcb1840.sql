-- Internal, non-visibility-filtered expansion used by the background
-- materializer. The public expand_event_occurrences keeps its per-user check.
CREATE OR REPLACE FUNCTION public.expand_event_occurrences_all(_event_id uuid, _from date, _to date)
 RETURNS TABLE(event_id uuid, original_occurrence_date date, effective_date date, start_time time without time zone, end_time time without time zone, status text, title text, location text, notes text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _e public.family_events%ROWTYPE;
  _scan_from date;
  _scan_to date;
BEGIN
  SELECT * INTO _e FROM public.family_events WHERE id = _event_id;
  IF _e.id IS NULL THEN RETURN; END IF;

  IF _e.recurrence_freq IS NULL THEN
    IF _e.date IS NOT NULL AND _e.date BETWEEN _from AND _to THEN
      RETURN QUERY SELECT _e.id, _e.date, _e.date, _e.time, _e.end_time,
                          'normal'::text, _e.title, _e.location, _e.notes;
    END IF;
    RETURN;
  END IF;

  _scan_from := GREATEST(_e.date, _from - 40);
  _scan_to := _to + 40;
  IF _e.recurrence_until IS NOT NULL THEN
    _scan_to := LEAST(_scan_to, _e.recurrence_until);
  END IF;
  IF _scan_to < _scan_from THEN RETURN; END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT d::date AS orig
    FROM generate_series(_scan_from, _scan_to, interval '1 day') AS d
    WHERE CASE _e.recurrence_freq
      WHEN 'daily' THEN ((d::date - _e.date) % _e.recurrence_interval) = 0
      WHEN 'weekly' THEN
        (
          CASE
            WHEN coalesce(array_length(_e.recurrence_byday, 1), 0) = 0
              THEN extract(isodow FROM d)::int = extract(isodow FROM _e.date)::int
            ELSE (ARRAY['MO','TU','WE','TH','FR','SA','SU'])[extract(isodow FROM d)::int]
                 = ANY (_e.recurrence_byday)
          END
        )
        AND (
          (
            (date_trunc('week', d)::date - date_trunc('week', _e.date::timestamp)::date) / 7
          ) % _e.recurrence_interval
        ) = 0
      WHEN 'monthly' THEN
        extract(day FROM d)::int = extract(day FROM _e.date)::int
        AND (
          (
            (extract(year FROM d)::int * 12 + extract(month FROM d)::int)
            - (extract(year FROM _e.date)::int * 12 + extract(month FROM _e.date)::int)
          ) % _e.recurrence_interval
        ) = 0
      ELSE false
    END
  ), resolved AS (
    SELECT
      _e.id AS event_id,
      c.orig AS original_occurrence_date,
      coalesce(ov.effective_date, c.orig) AS effective_date,
      coalesce(ov.start_time, _e.time) AS start_time,
      coalesce(ov.end_time, _e.end_time) AS end_time,
      coalesce(ov.status, 'normal') AS status,
      coalesce(ov.title, _e.title) AS title,
      coalesce(ov.location, _e.location) AS location,
      coalesce(ov.notes, _e.notes) AS notes
    FROM candidates c
    LEFT JOIN public.event_occurrence_overrides ov
      ON ov.event_id = _e.id AND ov.original_occurrence_date = c.orig
  )
  SELECT r.event_id, r.original_occurrence_date, r.effective_date, r.start_time,
         r.end_time, r.status, r.title, r.location, r.notes
  FROM resolved r
  WHERE r.status <> 'skipped'
    AND r.effective_date BETWEEN _from AND _to
  ORDER BY r.effective_date, r.start_time NULLS LAST;
END;
$function$;

REVOKE ALL ON FUNCTION public.expand_event_occurrences_all(uuid, date, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.materialize_reminder_occurrences(_horizon_days integer DEFAULT 21)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _from date := (now() AT TIME ZONE 'Europe/Zagreb')::date;
  _to date;
  _inserted integer := 0;
  _r record;
  _o record;
  _remind timestamptz;
BEGIN
  _to := _from + GREATEST(1, LEAST(_horizon_days, 120));

  FOR _r IN
    SELECT rem.id, rem.event_id, rem.offset_minutes, rem.offset_kind,
           rem.days_before, rem.at_time, e.time AS default_time
    FROM public.event_reminders rem
    JOIN public.family_events e ON e.id = rem.event_id
    WHERE rem.is_recurring
      AND rem.cancelled_at IS NULL
      AND e.recurrence_freq IS NOT NULL
  LOOP
    FOR _o IN
      SELECT * FROM public.expand_event_occurrences_all(_r.event_id, _from, _to)
    LOOP
      IF _r.offset_kind = 'calendar' AND _r.days_before IS NOT NULL THEN
        _remind := (((_o.effective_date - _r.days_before) + coalesce(_r.at_time, time '19:00'))
                      AT TIME ZONE 'Europe/Zagreb');
      ELSE
        _remind := ((_o.effective_date + coalesce(_o.start_time, _r.default_time, time '09:00'))
                      AT TIME ZONE 'Europe/Zagreb')
                   - (coalesce(_r.offset_minutes, 0) * interval '1 minute');
      END IF;

      INSERT INTO public.reminder_occurrences
        (reminder_id, original_occurrence_date, effective_date, remind_at)
      VALUES (_r.id, _o.original_occurrence_date, _o.effective_date, _remind)
      ON CONFLICT (reminder_id, original_occurrence_date) DO UPDATE
        SET effective_date = EXCLUDED.effective_date,
            remind_at = EXCLUDED.remind_at
        WHERE public.reminder_occurrences.sent_at IS NULL;

      _inserted := _inserted + 1;
    END LOOP;
  END LOOP;

  RETURN _inserted;
END;
$function$;