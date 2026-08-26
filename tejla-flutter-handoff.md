# Tejla — tehnički handoff za Flutter developera

Verzija: Faza 7 (recurring events V1 + HR kalendarske iznimke + cleanup podsjetnika)
Backend: Lovable Cloud (Postgres + Auth + RLS), web klijent: TanStack Start.

> Zlatno pravilo: **Flutter ne implementira vlastiti recurrence/exclusion engine.**
> Svako širenje serije, iznimke i podsjetnici dolaze iz backend RPC-a koji je jedini
> izvor istine. Web i mobilna aplikacija moraju uvijek prikazivati identične datume.

---

## 1. Recurring events V1 — model

Serija je **jedan red** u `family_events`, bez materijaliziranih instanci:

| Kolona | Značenje |
| --- | --- |
| `date`, `time`, `end_time` | početak serije (DTSTART) i vrijeme trajanja |
| `recurrence_freq` | `NULL` = jednokratni događaj, `'weekly'` = serija (V1 podržava weekly) |
| `recurrence_interval` | svakih N tjedana (default 1) |
| `recurrence_byday` | npr. `{TU}`, `{MO,WE,FR}` |
| `recurrence_until` | zadnji dan serije (može biti `NULL`) |
| `recurrence_note` | slobodan tekst iznimke koju nije moguće pouzdano mapirati |
| `recurrence_exclude` | whitelist kodova automatskih iznimki (v. §5) |

**Identitet occurrencea je `original_occurrence_date`** (datum koji pravilo generira),
a ne pomaknuti datum. Pomak se bilježi kao override, identitet ostaje isti.

### `event_occurrence_overrides`

| Kolona | Značenje |
| --- | --- |
| `event_id` + `original_occurrence_date` | ključ occurrencea |
| `status` | `skipped` (otkazan) ili `modified` (izmijenjen) |
| `effective_date`, `start_time`, `end_time` | pomak termina |
| `title`, `location`, `notes` | override sadržaja |

UX pravilo: kod uređivanja serije korisnik bira **„Uredi samo ovaj”** (→ override)
ili **„Uredi cijelu seriju”** (→ izmjena reda u `family_events`).

---

## 2. Expansion RPC — jedini izvor istine

- `expand_event_occurrences(_event_id, _from, _to)` — javni RPC, poštuje RLS/vidljivost.
- `expand_family_occurrences(_family_id, _from, _to)` — expanzija cijele obitelji za kalendar.
- `expand_event_occurrences_all(_event_id, _from, _to)` — **interni** (samo `service_role`),
  bez filtera vidljivosti; koristi ga reminder engine. Flutter ga ne zove.

Vraćaju: `event_id, original_occurrence_date, effective_date, start_time, end_time, status, title, location, notes`.

Prioritet pravila u expanziji (identičan u obje funkcije):

1. `skipped` override — occurrence uvijek nestaje.
2. `modified` override — ima prednost nad automatskom iznimkom (ostaje vidljiv čak i na isključen dan).
3. Automatska HR iznimka (`recurrence_exclude`) — uklanja samo `normal` occurrence.
4. `recurrence_exclude = '{}'` daje identičan rezultat kao model prije Faze 5.

Flutter: dohvat kalendara = jedan poziv `expand_family_occurrences` za vidljivi raspon.

---

## 3. Podsjetnici

### `event_reminders` (pravilo)

| Kolona | Značenje |
| --- | --- |
| `is_recurring` | `true` za pravilo koje se primjenjuje na svaki occurrence serije |
| `offset_kind` | `relative` ili `calendar` |
| `offset_minutes` | za `relative`: koliko minuta prije početka occurrencea (npr. 120 = „2 h prije”) |
| `days_before`, `at_time` | za `calendar`: npr. „dan prije u 19:00” = `days_before=1, at_time='19:00'` |
| `recipient_mode`, `recipient_user_ids` | kome ide |
| `cancelled_at` | otkazano pravilo |

Zašto dvije vrste: „dan prije u 19:00” **ne smije** biti sveden na fiksni broj minuta —
kod prelaska na/sa ljetnog vremena rezultat bi bio kriv. `calendar` pravila se računaju
u lokalnom **Europe/Zagreb** vremenu.

### `reminder_occurrences` (materijalizacija)

Ključ: `(reminder_id, original_occurrence_date)`; polja `effective_date`, `remind_at`,
`sent_at`, `cancelled_at`.

- `materialize_reminder_occurrences(_horizon_days)` — klizni prozor (default 21 dana),
  računa `remind_at` u Europe/Zagreb, idempotentan (`ON CONFLICT DO UPDATE` samo dok je `sent_at IS NULL`).
- `claim_due_reminder_occurrences(_limit)` — cron preuzima dospjele redove; jedan red = jedna isporuka.
- **`cleanup_reminder_occurrences(_horizon_days)` (Faza 7)** — briše **samo neposlane**
  (`sent_at IS NULL`) buduće redove koji više nisu dio kanonske
  `expand_event_occurrences_all` expanzije: skip override, nova školska pauza/blagdan,
  promjena pravila serije, `recurrence_until`, otkazano ili više ne-recurring pravilo.
  Poslani podsjetnici se **nikad** ne brišu ni ne mijenjaju. Funkcija je idempotentna i
  sigurna za paralelne cron runove (set-based delete, bez side effecta), a poziva se
  automatski na kraju `materialize_reminder_occurrences`.

Cron: `POST /api/public/hooks/send-reminders` (autentikacija preko `CRON_SECRET`) →
materialize + cleanup + claim + isporuka.

---

## 4. HR kalendar

- `hr_public_holiday(_year)` — deterministički set hrvatskih blagdana (fiksni + pomični,
  Uskrs po Meeus/Gauss algoritmu).
- `school_calendars` (`scope='HR'`, `school_year`, `valid_from`, `valid_to`) i
  `school_breaks` (`starts_on`, `ends_on`, `label`) — MZOM podaci, trenutno 2026./2027.
- `is_excluded_hr(_day, _kinds)` — je li dan isključen za zadane kodove.
- `school_calendar_coverage(_from, _to)` — pokrivenost MZOM podacima; UI prikazuje banner
  u kalendaru kada postoji serija s `school_breaks_hr`, a vidljivi period nije pokriven.

Flutter: nikad ne računa blagdane ni praznike lokalno — koristi RPC-e gore.

---

## 5. `recurrence_exclude` (whitelist)

Dozvoljeni kodovi (DB CHECK constraint + server-side sanitizacija):

- `school_breaks_hr` — bez školskih praznika
- `public_holidays_hr` — bez blagdana
- `weekends` — bez vikenda

AI mapiranje (Tejla nikad ne izmišlja konkretne datume):

| Izraz | Rezultat |
| --- | --- |
| „osim školskih praznika / školskih odmora / kad nema škole” | `school_breaks_hr` |
| „osim blagdana / praznikom ne radi” | `public_holidays_hr` |
| „osim neradnih dana” | `public_holidays_hr` + `weekends` |
| „svaki radni dan” | weekly MO-FR, bez vikenda |

Nemapirano ostaje u `recurrence_note` (`exception_note` u AI izlazu) kao tekstualni fallback.

---

## 6. Child / tinejdžer permissions (aktualno)

Provodi se DB triggerima (`guard_family_event_update`, `guard_event_member_write`,
`guard_event_reminder_write`), ne samo UI-jem:

- Dijete može kreirati događaj **samo sebi**.
- Dijete može kreirati podsjetnik **samo sebi**.
- Na obvezi koju je kreirala odrasla osoba dijete smije **samo** označiti zadatak
  završenim/nezavršenim.
- Dijete **ne smije** mijenjati `recurrence_freq`, `recurrence_interval`, `recurrence_byday`,
  `recurrence_until` ni `recurrence_exclude` na tuđem događaju — pokušaj podiže grešku.

---

## 7. Test status

- Puni suite: prolazi (uklj. DB testove koji se izvode u transakciji s rollbackom).
- Pokriveno: HR blagdani i školski praznici, exclusion filter u obje expansion funkcije,
  weekly occurrencei, DST prijelaz, 21-dnevni prozor, overridei, te Faza 7 cleanup
  (isključen neposlani red se briše, poslani ostaje, jednokratni podsjetnici netaknuti,
  ponovni i paralelni run ne mijenjaju rezultat).
- DB testovi se automatski preskaču kad managed baza nije dostupna.
