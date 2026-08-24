import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for the "permission denied for function" class of outage.
 *
 * A SECURITY DEFINER helper still needs EXECUTE for the *caller* role. If an
 * RLS policy references a function that `authenticated` may not execute, every
 * Data API read of that table fails with 42501 — which is exactly how the
 * calendar went blank after a least-privilege cleanup revoked EXECUTE on
 * can_access_event(uuid), used by the event_members and event_reminders
 * SELECT policies.
 *
 * The test needs the managed database env (PGHOST & friends); it self-skips
 * when they are absent so local/CI runs without a database stay green.
 */

const hasDb = Boolean(process.env["PGHOST"]);

function psql(sql: string): string {
  return execFileSync("psql", ["-At", "-c", sql], { encoding: "utf8" });
}

/**
 * Every function referenced from an RLS policy expression on a public table,
 * paired with whether `authenticated` holds EXECUTE on it.
 */
const QUERY = `
with policy_fns as (
  select distinct p.oid as fn_oid
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.pronamespace = 'public'::regnamespace
  where n.nspname = 'public'
    and (
      coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') like '%' || p.proname || '(%'
      or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') like '%' || p.proname || '(%'
    )
)
select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
       || '|' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
from policy_fns f
join pg_proc p on p.oid = f.fn_oid
order by 1
`;

describe.skipIf(!hasDb)("RLS policy helper functions", () => {
  it("are all executable by authenticated", () => {
    const rows = psql(QUERY)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [signature, granted] = l.split("|");
        return { signature: signature!, granted: granted === "true" };
      });

    expect(rows.length).toBeGreaterThan(0);
    const missing = rows.filter((r) => !r.granted).map((r) => r.signature);
    expect(missing).toEqual([]);
  });

  it("covers can_access_event, the helper behind event_members/event_reminders reads", () => {
    const acl = psql(
      "select has_function_privilege('authenticated','public.can_access_event(uuid)','EXECUTE')",
    ).trim();
    expect(acl).toBe("true");

    const anon = psql(
      "select has_function_privilege('anon','public.can_access_event(uuid)','EXECUTE')",
    ).trim();
    expect(anon).toBe("false");
  });
});
