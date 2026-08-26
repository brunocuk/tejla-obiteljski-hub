import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * Phase 7: cleanup of unsent reminder_occurrences that are no longer part of the
 * canonical expand_event_occurrences_all expansion.
 *
 * Everything runs inside a transaction that is always rolled back, on a real
 * family of the managed database. Self-skips without the managed DB env.
 */

const hasDb = Boolean(process.env["PGHOST"]);
const d = describe.skipIf(!hasDb);

const EVENT = "'63333333-3333-3333-3333-333333333333'";
const REM = "'64444444-4444-4444-4444-444444444444'";
const ONESHOT_EVENT = "'65555555-5555-5555-5555-555555555555'";
const ONESHOT_REM = "'66666666-6666-6666-6666-666666666666'";
const CAL = "'67777777-7777-7777-7777-777777777777'";
const TODAY = "(now() AT TIME ZONE 'Europe/Zagreb')::date";

/**
 * Weekly series (skips school breaks) with a recurring relative reminder, a plain
 * one-off reminder, and a materialized 21 day window. The occurrence in one week
 * is marked as already sent.
 */
const FIXTURE = `
BEGIN;
CREATE TEMP TABLE ctx AS
  SELECT fu.family_id, fu.user_id FROM public.family_users fu WHERE fu.role='owner' LIMIT 1;
SELECT set_config('request.jwt.claims', json_build_object('sub', user_id)::text, true) FROM ctx;

INSERT INTO public.family_events (id, family_id, title, date, time, type, created_by,
                                  recurrence_freq, recurrence_interval, recurrence_exclude)
SELECT ${EVENT}, family_id, 'CLEANUP SERIES', ${TODAY}, '17:00', 'event', user_id,
       'weekly', 1, ARRAY['school_breaks_hr'] FROM ctx;
INSERT INTO public.event_reminders (id, event_id, remind_at, recipient_mode, created_by,
                                    is_recurring, offset_kind, offset_minutes)
SELECT ${REM}, ${EVENT}, now() + interval '1 hour', 'creator_only', user_id,
       true, 'relative', 120 FROM ctx;

INSERT INTO public.family_events (id, family_id, title, date, time, type, created_by)
SELECT ${ONESHOT_EVENT}, family_id, 'CLEANUP ONE OFF', ${TODAY} + 3, '10:00', 'event', user_id FROM ctx;
INSERT INTO public.event_reminders (id, event_id, remind_at, recipient_mode, created_by)
SELECT ${ONESHOT_REM}, ${ONESHOT_EVENT}, now() + interval '1 day', 'creator_only', user_id FROM ctx;

SELECT public.materialize_reminder_occurrences(21);
UPDATE public.reminder_occurrences SET sent_at = now()
  WHERE reminder_id=${REM} AND original_occurrence_date=${TODAY} + 7;
`;

/** A school calendar published after the reminders were materialized. */
const NEW_SCHOOL_BREAK = `
INSERT INTO public.school_calendars (id, scope, school_year, valid_from, valid_to)
VALUES (${CAL}, 'HR', '2098/2099', ${TODAY}, ${TODAY} + 30);
INSERT INTO public.school_breaks (calendar_id, starts_on, ends_on, label)
VALUES (${CAL}, ${TODAY} + 5, ${TODAY} + 20, 'TEST BREAK');
`;

function run(body: string): Record<string, string> {
  const out = execFileSync("psql", ["-At", "-v", "ON_ERROR_STOP=1"], {
    encoding: "utf8",
    input: `${FIXTURE}\n${body}\nROLLBACK;\n`,
  });
  const map: Record<string, string> = {};
  for (const line of out.split("\n")) {
    const i = line.indexOf("=");
    if (i > 0 && /^[a-z_]+$/.test(line.slice(0, i))) map[line.slice(0, i)] = line.slice(i + 1);
  }
  return map;
}

d("cleanup_reminder_occurrences", () => {
  it("removes an unsent occurrence excluded by a newly published school calendar", () => {
    const r = run(`
      SELECT 'before='||count(*) FROM public.reminder_occurrences WHERE reminder_id=${REM};
      ${NEW_SCHOOL_BREAK}
      SELECT 'deleted='||public.cleanup_reminder_occurrences(21);
      SELECT 'excluded='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REM} AND original_occurrence_date=${TODAY} + 14;
      SELECT 'after='||count(*) FROM public.reminder_occurrences WHERE reminder_id=${REM};
    `);
    expect(r["before"]).toBe("4");
    expect(r["deleted"]).toBe("1");
    expect(r["excluded"]).toBe("0");
    expect(r["after"]).toBe("3");
  });

  it("never deletes an already sent occurrence, even when it becomes excluded", () => {
    const r = run(`
      ${NEW_SCHOOL_BREAK}
      SELECT 'ignore='||public.cleanup_reminder_occurrences(21);
      SELECT 'sent='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REM} AND original_occurrence_date=${TODAY} + 7
          AND sent_at IS NOT NULL;
    `);
    // The +7 occurrence falls inside the new break but was already delivered.
    expect(r["sent"]).toBe("1");
  });

  it("leaves plain one-off reminders untouched", () => {
    const r = run(`
      ${NEW_SCHOOL_BREAK}
      SELECT 'ignore='||public.cleanup_reminder_occurrences(21);
      SELECT 'oneoff='||count(*) FROM public.event_reminders
        WHERE id=${ONESHOT_REM} AND cancelled_at IS NULL AND NOT is_recurring;
      SELECT 'oneoff_rows='||count(*) FROM public.reminder_occurrences WHERE reminder_id=${ONESHOT_REM};
    `);
    expect(r["oneoff"]).toBe("1");
    expect(r["oneoff_rows"]).toBe("0");
  });

  it("is idempotent: repeated runs change nothing", () => {
    const r = run(`
      ${NEW_SCHOOL_BREAK}
      SELECT 'first='||public.cleanup_reminder_occurrences(21);
      SELECT 'second='||public.cleanup_reminder_occurrences(21);
      SELECT 'third='||public.cleanup_reminder_occurrences(21);
      SELECT 'rows='||count(*) FROM public.reminder_occurrences WHERE reminder_id=${REM};
    `);
    expect(r["first"]).toBe("1");
    expect(r["second"]).toBe("0");
    expect(r["third"]).toBe("0");
    expect(r["rows"]).toBe("3");
  });

  it("stays stable across a full materialize+cleanup cron cycle (parallel-safe)", () => {
    const r = run(`
      ${NEW_SCHOOL_BREAK}
      SELECT 'ignore1='||public.cleanup_reminder_occurrences(21);
      SELECT 'ignore2='||public.materialize_reminder_occurrences(21);
      SELECT 'ignore3='||public.materialize_reminder_occurrences(21);
      SELECT 'extra='||public.cleanup_reminder_occurrences(21);
      SELECT 'rows='||count(*) FROM public.reminder_occurrences WHERE reminder_id=${REM};
      SELECT 'excluded='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REM} AND original_occurrence_date=${TODAY} + 14;
      SELECT 'sent='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REM} AND sent_at IS NOT NULL;
    `);
    // Materialize never resurrects an excluded occurrence, cleanup finds nothing new.
    expect(r["extra"]).toBe("0");
    expect(r["rows"]).toBe("3");
    expect(r["excluded"]).toBe("0");
    expect(r["sent"]).toBe("1");
  });

  it("drops future unsent occurrences when the series stops recurring", () => {
    const r = run(`
      UPDATE public.event_reminders SET cancelled_at = now() WHERE id=${REM};
      SELECT 'deleted='||public.cleanup_reminder_occurrences(21);
      SELECT 'unsent='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REM} AND sent_at IS NULL;
      SELECT 'sent='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REM} AND sent_at IS NOT NULL;
    `);
    expect(Number(r["deleted"])).toBeGreaterThanOrEqual(1);
    expect(r["unsent"]).toBe("0");
    expect(r["sent"]).toBe("1");
  });
});
