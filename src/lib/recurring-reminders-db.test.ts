import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * Database-level guarantees of the recurring reminder pipeline.
 *
 * Everything runs inside a transaction that is always rolled back, on a real
 * family of the managed database. The test self-skips when the managed
 * database env (PGHOST & friends) is absent.
 */

const hasDb = Boolean(process.env["PGHOST"]);
const d = describe.skipIf(!hasDb);

const EVENT = "'33333333-3333-3333-3333-333333333333'";
const REL = "'44444444-4444-4444-4444-444444444444'";
const CAL = "'55555555-5555-5555-5555-555555555555'";

/** Fixture: one weekly series with a relative and a calendar reminder rule. */
const setup = (timeSql = "'17:00'", offset = 120) => `
BEGIN;
CREATE TEMP TABLE ctx AS
  SELECT fu.family_id, fu.user_id FROM public.family_users fu WHERE fu.role='owner' LIMIT 1;
SELECT set_config('request.jwt.claims', json_build_object('sub', user_id)::text, true) FROM ctx;
INSERT INTO public.family_events (id, family_id, title, date, time, type, created_by,
                                  recurrence_freq, recurrence_interval)
SELECT ${EVENT}, family_id, 'TEST SERIES', (now() AT TIME ZONE 'Europe/Zagreb')::date,
       ${timeSql}, 'event', user_id, 'weekly', 1 FROM ctx;
INSERT INTO public.event_reminders (id, event_id, remind_at, recipient_mode, created_by,
                                    is_recurring, offset_kind, offset_minutes)
SELECT ${REL}, ${EVENT}, now() + interval '1 hour', 'creator_only', user_id,
       true, 'relative', ${offset} FROM ctx;
INSERT INTO public.event_reminders (id, event_id, remind_at, recipient_mode, created_by,
                                    is_recurring, offset_kind, days_before, at_time)
SELECT ${CAL}, ${EVENT}, now() + interval '2 hour', 'creator_only', user_id,
       true, 'calendar', 1, '19:00' FROM ctx;
`;

function run(body: string, fixture = setup()): Record<string, string> {
  const out = execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1"], {
    encoding: "utf8",
    input: `${fixture}\n${body}\nROLLBACK;\n`,
  });
  const map: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && /^[a-z_]+$/.test(line.slice(0, i))) map[line.slice(0, i)] = line.slice(i + 1);
  }
  return map;
}

d("materialize_reminder_occurrences", () => {
  it("fills a 21 day sliding window and is safe to run twice", () => {
    const r = run(`
      SELECT 'first='||public.materialize_reminder_occurrences(21);
      SELECT 'second='||public.materialize_reminder_occurrences(21);
      SELECT 'rows='||count(*) FROM public.reminder_occurrences WHERE reminder_id=${REL};
      SELECT 'span='||(max(effective_date)-min(effective_date))
        FROM public.reminder_occurrences WHERE reminder_id=${REL};
      SELECT 'beyond='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REL}
          AND effective_date > (now() AT TIME ZONE 'Europe/Zagreb')::date + 21;
    `);
    // Weekly series over 21 days: today + 3 more weeks.
    expect(r["rows"]).toBe("4");
    expect(Number(r["span"])).toBeLessThanOrEqual(21);
    expect(r["beyond"]).toBe("0");
    // Second run updates in place; no duplicates.
    expect(r["first"]).toBe(r["second"]);
  });

  it("uses Europe/Zagreb local time for both rule kinds", () => {
    const r = run(`
      SELECT 'ignore='||public.materialize_reminder_occurrences(21);
      SELECT 'rel='||string_agg(DISTINCT to_char(remind_at AT TIME ZONE 'Europe/Zagreb','HH24:MI'), ',')
        FROM public.reminder_occurrences WHERE reminder_id=${REL};
      SELECT 'cal='||string_agg(DISTINCT to_char(remind_at AT TIME ZONE 'Europe/Zagreb','HH24:MI'), ',')
        FROM public.reminder_occurrences WHERE reminder_id=${CAL};
      SELECT 'caldays='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${CAL}
          AND (remind_at AT TIME ZONE 'Europe/Zagreb')::date = effective_date - 1;
    `);
    expect(r["rel"]).toBe("15:00");
    expect(r["cal"]).toBe("19:00");
    expect(r["caldays"]).toBe("4");
  });
});

d("occurrence overrides", () => {
  it("moves the reminder of a moved occurrence", () => {
    const r = run(`
      SELECT 'ignore='||public.materialize_reminder_occurrences(21);
      INSERT INTO public.event_occurrence_overrides
        (event_id, original_occurrence_date, status, effective_date, start_time, created_by)
      SELECT ${EVENT}, (now() AT TIME ZONE 'Europe/Zagreb')::date + 7, 'modified',
             (now() AT TIME ZONE 'Europe/Zagreb')::date + 8, '09:00', user_id FROM ctx;
      SELECT 'again='||public.materialize_reminder_occurrences(21);
      SELECT 'moved='||to_char(remind_at AT TIME ZONE 'Europe/Zagreb','YYYY-MM-DD HH24:MI')
        FROM public.reminder_occurrences
        WHERE reminder_id=${REL}
          AND original_occurrence_date = (now() AT TIME ZONE 'Europe/Zagreb')::date + 7;
      SELECT 'movedcal='||to_char(remind_at AT TIME ZONE 'Europe/Zagreb','YYYY-MM-DD HH24:MI')
        FROM public.reminder_occurrences
        WHERE reminder_id=${CAL}
          AND original_occurrence_date = (now() AT TIME ZONE 'Europe/Zagreb')::date + 7;
      SELECT 'expected='||to_char(((now() AT TIME ZONE 'Europe/Zagreb')::date + 8) + time '07:00','YYYY-MM-DD HH24:MI');
      SELECT 'expectedcal='||to_char(((now() AT TIME ZONE 'Europe/Zagreb')::date + 7) + time '19:00','YYYY-MM-DD HH24:MI');
    `);
    expect(r["moved"]).toBe(r["expected"]);
    expect(r["movedcal"]).toBe(r["expectedcal"]);
  });

  it("cancels the reminder of a skipped occurrence", () => {
    const r = run(`
      SELECT 'ignore='||public.materialize_reminder_occurrences(21);
      INSERT INTO public.event_occurrence_overrides
        (event_id, original_occurrence_date, status, created_by)
      SELECT ${EVENT}, (now() AT TIME ZONE 'Europe/Zagreb')::date + 7, 'skipped', user_id FROM ctx;
      SELECT 'afterdelete='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REL}
          AND original_occurrence_date = (now() AT TIME ZONE 'Europe/Zagreb')::date + 7;
      SELECT 'again='||public.materialize_reminder_occurrences(21);
      SELECT 'afterrematerialize='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REL}
          AND original_occurrence_date = (now() AT TIME ZONE 'Europe/Zagreb')::date + 7;
    `);
    expect(r["afterdelete"]).toBe("0");
    expect(r["afterrematerialize"]).toBe("0");
  });
});

d("claim_due_reminder_occurrences", () => {
  it("hands a due occurrence to exactly one cron run", () => {
    const r = run(
      `
      SELECT 'ignore='||public.materialize_reminder_occurrences(21);
      SELECT 'firstrun='||count(*) FROM public.claim_due_reminder_occurrences(100);
      SELECT 'secondrun='||count(*) FROM public.claim_due_reminder_occurrences(100);
      SELECT 'sent='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REL} AND sent_at IS NOT NULL;
    `,
      // Series whose today occurrence started 10 minutes ago, reminded at start.
      setup("((now() AT TIME ZONE 'Europe/Zagreb') - interval '10 minutes')::time", 0),
    );
    expect(r["firstrun"]).toBe("1");
    // A parallel run finds nothing left to claim: no duplicate push.
    expect(r["secondrun"]).toBe("0");
    expect(r["sent"]).toBe("1");
  });
});
