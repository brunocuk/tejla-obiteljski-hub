-- ============================================================
-- Seed: MZOM skolski kalendar 2026./2027. (rucni unos pri selidbi)
--
-- Izvor: Odluka o pocetku i zavrsetku nastavne godine, broju radnih
-- dana i trajanju odmora ucenika osnovnih i srednjih skola za
-- skolsku godinu 2026./2027., NN 58/2026 (3.6.2026.)
-- https://narodne-novine.nn.hr/clanci/sluzbeni/2026_06_58_724.html
--
-- Datumi iz odluke:
--   nastavna godina: 7.9.2026. do 15.6.2027. (zavrsni razredi SS do 21.5.2027.)
--   zimski odmor 1. dio: 24.12.2026. do 5.1.2027. (nastava od 7.1.; 6.1. je blagdan
--     Bogojavljenje i pokriva ga hr_public_holiday, ne ovaj seed)
--   zimski odmor 2. dio: 22.2.2027. do 26.2.2027. (nastava od 1.3.)
--   proljetni odmor: 25.3.2027. do 2.4.2027. (nastava od 5.4.)
--   ljetni odmor: od 16.6.2027. (ovdje do kraja skolske godine, 31.8.2027.)
--
-- Skripta je idempotentna: ponovno pokretanje osvjezi kalendar i breakove.
-- Novi kalendar (2027./2028.) dodaje se svake godine kad MZOM objavi odluku,
-- obicno krajem svibnja / pocetkom lipnja.
-- ============================================================

BEGIN;

INSERT INTO public.school_calendars (scope, school_year, valid_from, valid_to, source_url, published_at)
VALUES (
  'HR',
  '2026/2027',
  DATE '2026-09-01',
  DATE '2027-08-31',
  'https://narodne-novine.nn.hr/clanci/sluzbeni/2026_06_58_724.html',
  DATE '2026-06-03'
)
ON CONFLICT (scope, school_year) DO UPDATE
  SET valid_from  = EXCLUDED.valid_from,
      valid_to    = EXCLUDED.valid_to,
      source_url  = EXCLUDED.source_url,
      published_at = EXCLUDED.published_at;

DELETE FROM public.school_breaks b
USING public.school_calendars c
WHERE b.calendar_id = c.id
  AND c.scope = 'HR'
  AND c.school_year = '2026/2027';

INSERT INTO public.school_breaks (calendar_id, starts_on, ends_on, label)
SELECT c.id, v.starts_on, v.ends_on, v.label
FROM public.school_calendars c,
     (VALUES
       (DATE '2026-12-24', DATE '2027-01-05', 'Zimski odmor, prvi dio'),
       (DATE '2027-02-22', DATE '2027-02-26', 'Zimski odmor, drugi dio'),
       (DATE '2027-03-25', DATE '2027-04-02', 'Proljetni odmor'),
       (DATE '2027-06-16', DATE '2027-08-31', 'Ljetni odmor')
     ) AS v(starts_on, ends_on, label)
WHERE c.scope = 'HR'
  AND c.school_year = '2026/2027';

COMMIT;

-- Brza provjera:
--   SELECT c.school_year, b.label, b.starts_on, b.ends_on
--   FROM public.school_breaks b JOIN public.school_calendars c ON c.id = b.calendar_id
--   ORDER BY b.starts_on;
