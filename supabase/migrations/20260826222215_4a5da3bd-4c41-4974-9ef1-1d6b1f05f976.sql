CREATE OR REPLACE FUNCTION public.cleanup_reminder_occurrences(_horizon_days integer DEFAULT 21)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _from date := (now() AT TIME ZONE 'Europe/Zagreb')::date;
  _to date;
  _deleted integer := 0;
  _n integer;
  _r record;
BEGIN
  _to := _from + GREATEST(1, LEAST(_horizon_days, 120));

  -- 1) Reminders that are no longer recurring rules at all (cancelled reminder,
  --    deleted/again-one-off event). Only future, unsent rows are removed.
  DELETE FROM public.reminder_occurrences ro
  USING public.event_reminders rem
  LEFT JOIN public.family_events e ON e.id = rem.event_id
  WHERE ro.reminder_id = rem.id
    AND ro.sent_at IS NULL
    AND ro.effective_date >= _from
    AND (rem.cancelled_at IS NOT NULL
         OR NOT rem.is_recurring
         OR e.id IS NULL
         OR e.recurrence_freq IS NULL);
  GET DIAGNOSTICS _n = ROW_COUNT;
  _deleted := _deleted + _n;

  -- 2) Still-active recurring rules: drop unsent rows whose occurrence is no
  --    longer produced by the canonical expansion (skip override, HR calendar
  --    exclusion, changed series rule, shortened until date, ...).
  FOR _r IN
    SELECT rem.id, rem.event_id
    FROM public.event_reminders rem
    JOIN public.family_events e ON e.id = rem.event_id
    WHERE rem.is_recurring
      AND rem.cancelled_at IS NULL
      AND e.recurrence_freq IS NOT NULL
  LOOP
    DELETE FROM public.reminder_occurrences ro
    WHERE ro.reminder_id = _r.id
      AND ro.sent_at IS NULL
      AND ro.effective_date >= _from
      AND ro.original_occurrence_date BETWEEN _from AND _to
      AND NOT EXISTS (
        SELECT 1
        FROM public.expand_event_occurrences_all(_r.event_id, _from, _to) x
        WHERE x.original_occurrence_date = ro.original_occurrence_date
      );
    GET DIAGNOSTICS _n = ROW_COUNT;
    _deleted := _deleted + _n;
  END LOOP;

  RETURN _deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_reminder_occurrences(integer) FROM PUBLIC, anon, authenticated;

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

  PERFORM public.cleanup_reminder_occurrences(_horizon_days);

  RETURN _inserted;
END;
$function$;