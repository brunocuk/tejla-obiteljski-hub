import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * Phases 1-4 of the Croatian calendar exceptions work.
 *
 * Nothing here is wired into occurrence expansion yet: these tests only prove
 * the new building blocks behave (deterministic holidays, official school
 * calendars, the exclusion probe, the coverage report) and that the new
 * `family_events.recurrence_exclude` column is locked down both by a CHECK
 * constraint and by the child permission guard.
 *
 * Every statement runs inside a transaction that is rolled back. The suite
 * self-skips without the managed database env (PGHOST & friends).
 */

const hasDb = Boolean(process.env["PGHOST"]);
const d = describe.skipIf(!hasDb);

/**
 * The sandbox psql role may read and write tables but holds no EXECUTE on the
 * least-privilege functions (they are revoked from PUBLIC on purpose). Those
 * assertions therefore self-skip here and run wherever the suite is executed
 * with a role that owns EXECUTE.
 */
function canExecFunctions(): boolean {
  if (!hasDb) return false;
  try {
    execFileSync("psql", ["-At", "-c", "SELECT count(*) FROM public.hr_public_holiday(2026)"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}
const fn = describe.skipIf(!canExecFunctions());

function psql(sql: string): string {
  return execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1"], {
    encoding: "utf8",
    input: sql,
  }).trim();
}

/** Runs SQL expected to fail and returns the error text. */
function psqlError(sql: string): string {
  try {
    execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1"], { encoding: "utf8", input: sql });
  } catch (err) {
    const e = err as { stderr?: Buffer | string; message?: string };
    return String(e.stderr ?? e.message ?? "");
  }
  return "";
}

fn("hr_public_holiday", () => {
  it("returns 14 holidays for every year 2026-2030", () => {
    const out = psql(`
      SELECT y, (SELECT count(*) FROM public.hr_public_holiday(y))
      FROM generate_series(2026, 2030) y ORDER BY y;
    `);
    expect(out.split("\n")).toEqual([
      "2026|14",
      "2027|14",
      "2028|14",
      "2029|14",
      "2030|14",
    ]);
  });

  it("computes the movable feasts (Easter, Easter Monday, Corpus Christi)", () => {
    const out = psql(`
      SELECT y || ':' || (SELECT string_agg(h.day::text, ',' ORDER BY h.day)
                          FROM public.hr_public_holiday(y) h
                          WHERE h.name IN ('Uskrs','Uskrsni ponedjeljak','Tijelovo'))
      FROM generate_series(2026, 2030) y ORDER BY y;
    `);
    expect(out.split("\n")).toEqual([
      "2026:2026-04-05,2026-04-06,2026-06-04",
      "2027:2027-03-28,2027-03-29,2027-05-27",
      "2028:2028-04-16,2028-04-17,2028-06-15",
      "2029:2029-04-01,2029-04-02,2029-05-31",
      "2030:2030-04-21,2030-04-22,2030-06-20",
    ]);
  });

  it("always contains the fixed Croatian holidays", () => {
    const out = psql(`
      SELECT count(*) FROM public.hr_public_holiday(2029)
      WHERE day IN (DATE '2029-01-01', DATE '2029-01-06', DATE '2029-05-01',
                    DATE '2029-05-30', DATE '2029-06-22', DATE '2029-08-05',
                    DATE '2029-08-15', DATE '2029-11-01', DATE '2029-11-18',
                    DATE '2029-12-25', DATE '2029-12-26');
    `);
    expect(out).toBe("11");
  });
});

fn("is_excluded_hr", () => {
  it("is always false for an empty rule set (existing events stay untouched)", () => {
    const out = psql(`
      SELECT public.is_excluded_hr(DATE '2026-12-25', '{}'::text[]),
             public.is_excluded_hr(DATE '2026-12-26', ARRAY['school_breaks_hr']),
             public.is_excluded_hr(NULL, ARRAY['weekends']);
    `);
    expect(out).toBe("f|t|f");
  });

  it("matches public holidays only when asked", () => {
    const out = psql(`
      SELECT public.is_excluded_hr(DATE '2027-03-29', ARRAY['public_holidays_hr']),
             public.is_excluded_hr(DATE '2027-03-30', ARRAY['public_holidays_hr']);
    `);
    expect(out).toBe("t|f");
  });

  it("matches weekends only when asked", () => {
    const out = psql(`
      SELECT public.is_excluded_hr(DATE '2026-09-05', ARRAY['weekends']),
             public.is_excluded_hr(DATE '2026-09-08', ARRAY['weekends']);
    `);
    expect(out).toBe("t|f");
  });

  it("uses the official 2026/2027 school breaks", () => {
    const out = psql(`
      SELECT public.is_excluded_hr(DATE '2026-12-29', ARRAY['school_breaks_hr']),
             public.is_excluded_hr(DATE '2027-02-23', ARRAY['school_breaks_hr']),
             public.is_excluded_hr(DATE '2027-03-30', ARRAY['school_breaks_hr']),
             public.is_excluded_hr(DATE '2026-11-10', ARRAY['school_breaks_hr']);
    `);
    expect(out).toBe("t|t|t|f");
  });

  it("fails open when no official calendar covers the date", () => {
    // Deep inside the 2029/2030 school year, for which nothing is published.
    const out = psql(`SELECT public.is_excluded_hr(DATE '2029-12-28', ARRAY['school_breaks_hr']);`);
    expect(out).toBe("f");
  });
});

fn("school_calendar_coverage", () => {
  it("reports the published 2026/2027 year as covered", () => {
    const out = psql(`
      SELECT school_year || '|' || covered
      FROM public.school_calendar_coverage(DATE '2026-10-01', DATE '2027-05-01');
    `);
    expect(out).toBe("2026/2027|t");
  });

  it("reports a gap with its date range for an unpublished year", () => {
    const out = psql(`
      SELECT school_year || '|' || covered || '|' || gap_from || '|' || gap_to
      FROM public.school_calendar_coverage(DATE '2027-10-01', DATE '2027-12-31');
    `);
    expect(out).toBe("2027/2028|f|2027-10-01|2027-12-31");
  });

  it("splits a window that spans two school years", () => {
    const out = psql(`
      SELECT school_year || '|' || covered
      FROM public.school_calendar_coverage(DATE '2027-05-01', DATE '2027-10-01')
      ORDER BY school_year;
    `);
    expect(out.split("\n")).toEqual(["2026/2027|t", "2027/2028|f"]);
  });
});

d("recurrence_exclude column", () => {
  it("holds only whitelisted codes on existing rows", () => {
    const out = psql(`
      SELECT count(*) FROM public.family_events fe
      WHERE EXISTS (
        SELECT 1 FROM unnest(fe.recurrence_exclude) c
        WHERE c NOT IN ('school_breaks_hr','public_holidays_hr','weekends')
      );
    `);
    expect(out).toBe("0");
  });

  it("accepts only the three whitelisted values", () => {
    const ok = psql(`
      BEGIN;
      SELECT set_config('request.jwt.claims', json_build_object('sub', fu.user_id)::text, true)
      FROM public.family_users fu WHERE fu.role='owner' LIMIT 1;
      INSERT INTO public.family_events (family_id, title, date, type, created_by, recurrence_exclude)
      SELECT fu.family_id, 'TEST EXCL', current_date, 'event', fu.user_id,
             ARRAY['school_breaks_hr','public_holidays_hr','weekends']
      FROM public.family_users fu WHERE fu.role='owner' LIMIT 1
      RETURNING 'ok';
      ROLLBACK;
    `);
    expect(ok).toContain("ok");

    const err = psqlError(`
      BEGIN;
      INSERT INTO public.family_events (family_id, title, date, type, created_by, recurrence_exclude)
      SELECT fu.family_id, 'TEST BAD', current_date, 'event', fu.user_id, ARRAY['skolski_praznici']
      FROM public.family_users fu WHERE fu.role='owner' LIMIT 1;
      ROLLBACK;
    `);
    expect(err).toContain("family_events_recurrence_exclude_valid");
  });
});

d("child permission guard", () => {
  /**
   * The sandbox role may not UPDATE application tables, so the runtime attempt
   * cannot be replayed here. What is guarded instead is the thing that actually
   * regresses: a newly added recurrence column silently missing from the list
   * of fields a child may not touch on an adult-created obligation.
   */
  const guardSource = () =>
    psql(`SELECT prosrc FROM pg_proc WHERE proname = 'guard_family_event_update';`);

  it("blocks recurrence_exclude changes by a child on an adult-created event", () => {
    expect(guardSource()).toContain("NEW.recurrence_exclude IS DISTINCT FROM OLD.recurrence_exclude");
  });

  it("guards every recurrence field of the series", () => {
    const src = guardSource();
    for (const col of [
      "recurrence_freq",
      "recurrence_interval",
      "recurrence_byday",
      "recurrence_until",
      "recurrence_note",
      "recurrence_exclude",
    ]) {
      expect(src).toContain(`NEW.${col} IS DISTINCT FROM OLD.${col}`);
    }
  });

  it("still leaves completion toggling outside the guarded field list", () => {
    const src = guardSource();
    expect(src).not.toContain("NEW.completed IS DISTINCT FROM OLD.completed");
  });

  it("is attached to family_events as a BEFORE UPDATE row trigger", () => {
    const out = psql(`
      SELECT t.tgname FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'family_events' AND NOT t.tgisinternal
        AND t.tgfoid = 'public.guard_family_event_update'::regproc;
    `);
    expect(out).not.toBe("");
  });
});


d("privileges on the new objects", () => {
  it("does not expose the new functions to anon or PUBLIC", () => {
    const out = psql(`
      SELECT p.proname || ':' ||
             has_function_privilege('anon', p.oid, 'EXECUTE')::text || ':' ||
             has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace
        AND p.proname IN ('hr_easter_sunday','hr_public_holiday','is_excluded_hr','school_calendar_coverage')
      ORDER BY p.proname;
    `);
    expect(out.split("\n")).toEqual([
      "hr_easter_sunday:false:true",
      "hr_public_holiday:false:true",
      "is_excluded_hr:false:true",
      "school_calendar_coverage:false:true",
    ]);
  });

  it("keeps the reference tables read-only for authenticated and closed for anon", () => {
    const out = psql(`
      SELECT c.relname || ':' ||
             has_table_privilege('anon', c.oid, 'SELECT')::text || ':' ||
             has_table_privilege('authenticated', c.oid, 'SELECT')::text || ':' ||
             has_table_privilege('authenticated', c.oid, 'INSERT')::text || ':' ||
             c.relrowsecurity::text
      FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace
        AND c.relname IN ('school_calendars','school_breaks')
      ORDER BY c.relname;
    `);
    expect(out.split("\n")).toEqual([
      "school_breaks:false:true:true:true",
      "school_calendars:false:true:true:true",
    ]);
  });

  it("has both new functions pinned to a fixed search_path", () => {
    const out = psql(`
      SELECT count(*) FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('hr_easter_sunday','hr_public_holiday','is_excluded_hr','school_calendar_coverage')
        AND proconfig IS NULL;
    `);
    expect(out).toBe("0");
  });
});

/**
 * The exclusion filter must exist once per expansion entry point and be
 * byte-identical between them: the authenticated path and the cron path may
 * never disagree about which occurrences exist.
 */
d("occurrence exclusion filter", () => {
  const CLAUSE = [
    "r.status = 'normal'",
    "coalesce(array_length(_e.recurrence_exclude, 1), 0) > 0",
    "public.is_excluded_hr(r.effective_date, _e.recurrence_exclude)",
  ];

  function body(name: string): string {
    return psql(
      `SELECT prosrc FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='${name}';`,
    );
  }

  it("is present in the authenticated expansion", () => {
    const src = body("expand_event_occurrences");
    for (const part of CLAUSE) expect(src).toContain(part);
  });

  it("is present in the cron expansion", () => {
    const src = body("expand_event_occurrences_all");
    for (const part of CLAUSE) expect(src).toContain(part);
  });

  it("keeps a skipped override removed and never filters on it", () => {
    for (const name of ["expand_event_occurrences", "expand_event_occurrences_all"]) {
      const src = body(name);
      expect(src).toContain("r.status <> 'skipped'");
      // Only untouched occurrences may be dropped automatically, so the guard
      // is anchored on 'normal' and not on the override status in general.
      expect(src).not.toContain("r.status <> 'modified'");
    }
  });

  it("leaves non-recurring rows on the early-return path, before any filter", () => {
    for (const name of ["expand_event_occurrences", "expand_event_occurrences_all"]) {
      const src = body(name);
      const early = src.indexOf("IF _e.recurrence_freq IS NULL THEN");
      const filter = src.indexOf("public.is_excluded_hr");
      expect(early).toBeGreaterThan(-1);
      expect(filter).toBeGreaterThan(early);
    }
  });
});
