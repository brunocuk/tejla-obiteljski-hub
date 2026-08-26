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

/** Weekly series + recurring relative reminder, plus an untouched one-off reminder. */
const FIXTURE = `
BEGIN;
CREATE TEMP TABLE ctx AS
  SELECT fu.family_id, fu.user_id FROM public.family_users fu WHERE fu.role='owner' LIMIT 1;
SELECT set_config('request.jwt.claims', json_build_object('sub', user_id)::text, true) FROM ctx;

INSERT INTO public.family_events (id, family_id, title, date, time, type, created_by,
                                  recurrence_freq, recurrence_interval)
SELECT ${EVENT}, family_id, 'CLEANUP SERIES', (now() AT TIME ZONE 'Europe/Zagreb')::date,
       '17:00', 'event', user_id, 'weekly', 1 FROM ctx;
INSERT INTO public.event_reminders (id, event_id, remind_at, recipient_mode, created_by,
                                    is_recurring, offset_kind, offset_minutes)
SELECT ${REM}, ${EVENT}, now() + interval '1 hour', 'creator_only', user_id,
       true, 'relative', 120 FROM ctx;

INSERT INTO public.family_events (id, family_id, title, date, time, type, created_by)
SELECT ${ONESHOT_EVENT}, family_id, 'CLEANUP ONE OFF',
       (now() AT TIME ZONE 'Europe/Zagreb')::date + 3, '10:00', 'event', user_id FROM ctx;
INSERT INTO public.event_reminders (id, event_id, remind_at, recipient_mode, created_by)
SELECT ${ONESHOT_REM}, ${ONESHOT_EVENT}, now() + interval '1 day', 'creator_only', user_id FROM ctx;

SELECT public.materialize_reminder_occurrences(21);
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

/** Skip the occurrence one week from today, so it leaves the canonical expansion. */
const SKIP_NEXT_WEEK = `
INSERT INTO public.event_occurrence_overrides (event_id, original_occurrence_date, status, created_by)
SELECT ${EVENT}, (now() AT TIME ZONE 'Europe/Zagreb')::date + 7, 'skipped', user_id FROM ctx;
`;

d("cleanup_reminder_occurrences", () => {
  it("removes an unsent occurrence that is no longer in the expansion", () => {
    const r = run(`
      SELECT 'before='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REM}
          AND original_occurrence_date=(now() AT TIME ZONE 'Europe/Zagreb')::date + 7;
      ${SKIP_NEXT_WEEK}
      SELECT 'deleted='||public.cleanup_reminder_occurrences(21);
      SELECT 'after='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REM}
          AND original_occurrence_date=(now() AT TIME ZONE 'Europe/Zagreb')::date + 7;
      SELECT 'remaining='||count(*) FROM public.reminder_occurrences WHERE reminder_id=${REM};
    `);
    expect(r["before"]).toBe("1");
    expect(r["after"]).toBe("0");
    expect(Number(r["deleted"])).toBeGreaterThanOrEqual(1);
    expect(r["remaining"]).toBe("3");
  });

  it("never deletes or mutates an already sent occurrence", () => {
    const r = run(`
      UPDATE public.reminder_occurrences SET sent_at = now()
        WHERE reminder_id=${REM}
          AND original_occurrence_date=(now() AT TIME ZONE 'Europe/Zagreb')::date + 7;
      ${SKIP_NEXT_WEEK}
      SELECT 'ignore='||public.cleanup_reminder_occurrences(21);
      SELECT 'kept='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REM}
          AND original_occurrence_date=(now() AT TIME ZONE 'Europe/Zagreb')::date + 7
          AND sent_at IS NOT NULL;
    `);
    expect(r["kept"]).toBe("1");
  });

  it("leaves plain one-off reminders untouched", () => {
    const r = run(`
      SELECT 'oneoff='||count(*) FROM public.event_reminders
        WHERE id=${ONESHOT_REM} AND cancelled_at IS NULL AND NOT is_recurring;
      ${SKIP_NEXT_WEEK}
      SELECT 'ignore='||public.cleanup_reminder_occurrences(21);
      SELECT 'oneoff_after='||count(*) FROM public.event_reminders
        WHERE id=${ONESHOT_REM} AND cancelled_at IS NULL AND NOT is_recurring;
      SELECT 'oneoff_rows='||count(*) FROM public.reminder_occurrences WHERE reminder_id=${ONESHOT_REM};
    `);
    expect(r["oneoff"]).toBe("1");
    expect(r["oneoff_after"]).toBe("1");
    expect(r["oneoff_rows"]).toBe("0");
  });

  it("is idempotent and safe to run repeatedly / concurrently", () => {
    const r = run(`
      ${SKIP_NEXT_WEEK}
      SELECT 'first='||public.cleanup_reminder_occurrences(21);
      SELECT 'second='||public.cleanup_reminder_occurrences(21);
      SELECT 'third='||public.cleanup_reminder_occurrences(21);
      SELECT 'rows='||count(*) FROM public.reminder_occurrences WHERE reminder_id=${REM};
      -- A concurrent cron run would re-materialize and clean again: same end state.
      SELECT 'ignore='||public.materialize_reminder_occurrences(21);
      SELECT 'after_cycle='||public.cleanup_reminder_occurrences(21);
      SELECT 'rows_after='||count(*) FROM public.reminder_occurrences WHERE reminder_id=${REM};
    `);
    expect(Number(r["first"])).toBeGreaterThanOrEqual(1);
    expect(r["second"]).toBe("0");
    expect(r["third"]).toBe("0");
    expect(r["after_cycle"]).toBe("0");
    expect(r["rows_after"]).toBe(r["rows"]);
  });

  it("drops future unsent occurrences when the series stops recurring", () => {
    const r = run(`
      UPDATE public.family_events SET recurrence_freq = NULL WHERE id=${EVENT};
      SELECT 'deleted='||public.cleanup_reminder_occurrences(21);
      SELECT 'rows='||count(*) FROM public.reminder_occurrences
        WHERE reminder_id=${REM} AND sent_at IS NULL;
    `);
    expect(Number(r["deleted"])).toBeGreaterThanOrEqual(1);
    expect(r["rows"]).toBe("0");
  });
});
