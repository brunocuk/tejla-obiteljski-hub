ALTER TABLE public.event_reminders
  ADD COLUMN IF NOT EXISTS offset_kind text NOT NULL DEFAULT 'relative',
  ADD COLUMN IF NOT EXISTS days_before integer,
  ADD COLUMN IF NOT EXISTS at_time time without time zone;

ALTER TABLE public.event_reminders
  DROP CONSTRAINT IF EXISTS event_reminders_offset_kind_check;
ALTER TABLE public.event_reminders
  ADD CONSTRAINT event_reminders_offset_kind_check
  CHECK (offset_kind IN ('relative', 'calendar'));

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
      SELECT * FROM public.expand_event_occurrences(_r.event_id, _from, _to)
    LOOP
      IF _r.offset_kind = 'calendar' AND _r.days_before IS NOT NULL THEN
        -- Calendar-time rule ("prethodni dan u 19:00"): anchored in local wall
        -- clock, so a DST switch never shifts it by an hour.
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