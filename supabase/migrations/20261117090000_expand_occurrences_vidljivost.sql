-- Zakrpa (nalaz 13.11., obecano Mateji): expand_family_occurrences je filtrirao
-- samo po clanstvu u obitelji, bez pravila vidljivosti. Dijete s ogranicenom
-- vidljivoscu moglo je kroz RPC vidjeti ponavljajuce serije koje mu u kalendaru
-- inace nisu vidljive. Svaki event sada prolazi i kroz can_view_event().
CREATE OR REPLACE FUNCTION public.expand_family_occurrences(
  _family_id uuid,
  _from date,
  _to date
)
RETURNS TABLE (
  event_id uuid,
  original_occurrence_date date,
  effective_date date,
  start_time time,
  end_time time,
  status text,
  title text,
  location text,
  notes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT o.*
  FROM public.family_events e
  CROSS JOIN LATERAL public.expand_event_occurrences(e.id, _from, _to) o
  WHERE e.family_id = _family_id
    AND e.recurrence_freq IS NOT NULL
    AND public.is_family_member(_family_id)
    AND public.can_view_event(e.id)
$function$;
