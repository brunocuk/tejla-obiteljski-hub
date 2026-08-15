import { expect, test, type Page } from "@playwright/test";

/**
 * Real-browser E2E for the FamilyGate onboarding scenarios A/B/C/D.
 *
 * The Tejla backend is never touched: every Supabase call the gate makes is
 * intercepted and answered with a scripted fixture, so the tests exercise the
 * real routes, the real router guard and real clicks, but stay isolated from
 * production data.
 */

const PROJECT_REF = "eimafsffxczoxvtyvorz";
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
const USER_ID = "11111111-1111-1111-1111-111111111111";

type Invite = { id: string; family_id: string; family_name: string; role: string } | null;
type Member = { id: string; family_id: string; name: string; member_type: string; linked_user_id: string | null; created_at: string };

type Scenario = {
  familyId: string | null;
  invite: Invite;
  members: Member[];
};

function member(name: string, familyId = "family-1"): Member {
  return {
    id: "member-1",
    family_id: familyId,
    name,
    member_type: "parent",
    linked_user_id: USER_ID,
    created_at: new Date().toISOString(),
  };
}

/**
 * Fakes an authenticated Supabase session and every backend read the gate makes.
 * The stub is installed as a `fetch` shim inside the page (instead of
 * `page.route`) because Playwright cannot answer the CORS preflight that a
 * cross-origin Supabase POST triggers.
 */
async function setupBackend(page: Page, scenario: Scenario) {
  await page.addInitScript(
    ({ scenario, projectRef, storageKey, userId }) => {
      const state = { ...scenario };
      const calls = { accept: 0, create: 0, acceptedId: null as string | null };
      (window as unknown as Record<string, unknown>)["__tejlaCalls"] = calls;

      const sessionUser = {
        id: userId,
        email: "beta@tejla.app",
        aud: "authenticated",
        role: "authenticated",
      };
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          access_token: "e2e-fake-token",
          refresh_token: "e2e-fake-refresh",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: sessionUser,
        }),
      );

      const linkedMember = (name: string, familyId: string) => ({
        id: "member-1",
        family_id: familyId,
        name,
        member_type: "parent",
        linked_user_id: userId,
        created_at: new Date().toISOString(),
      });

      const reply = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });

      const realFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url;
        if (!url.includes(`${projectRef}.supabase.co`)) return realFetch(input as never, init);

        if (url.includes("/auth/v1/user")) return reply(sessionUser);
        if (url.includes("/rest/v1/family_users")) {
          return reply(state.familyId ? [{ family_id: state.familyId, role: "owner" }] : []);
        }
        if (url.includes("/rest/v1/family_members")) return reply(state.members);
        if (url.includes("/rpc/pending_family_invitation")) return reply(state.invite);
        if (url.includes("/rpc/accept_family_invitation")) {
          calls.accept += 1;
          try {
            const body = JSON.parse(String(init?.body ?? "{}")) as { _invitation_id?: string };
            calls.acceptedId = body._invitation_id ?? null;
          } catch {
            calls.acceptedId = null;
          }
          state.familyId = state.invite?.family_id ?? "family-invited";
          state.members = [linkedMember("Mateja", state.familyId)];
          return reply(state.familyId);
        }
        if (url.includes("/rpc/create_family")) {
          calls.create += 1;
          state.familyId = "family-new";
          state.members = [linkedMember("Mateja", state.familyId)];
          return reply(state.familyId);
        }
        // Anything else the app screens read: empty result set.
        return reply([]);
      };
    },
    { scenario, projectRef: PROJECT_REF, storageKey: STORAGE_KEY, userId: USER_ID },
  );

  return {
    async counts() {
      return page.evaluate(
        () =>
          (window as unknown as Record<
            string,
            { accept: number; create: number; acceptedId: string | null }
          >)["__tejlaCalls"],
      );
    },
  };
}

test.describe("FamilyGate onboarding (browser)", () => {
  test("A: new user without an invitation lands on the create-space screen", async ({ page }) => {
    const backend = await setupBackend(page, { familyId: null, invite: null, members: [] });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Tu si." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stvori svoj prostor" })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    expect((await backend.counts()).accept).toBe(0);
  });

  test("A2: creating a space opens the app", async ({ page }) => {
    const backend = await setupBackend(page, { familyId: null, invite: null, members: [] });

    await page.goto("/");
    await page.getByPlaceholder("Obitelj Horvat").fill("Obitelj Test");
    await page.getByPlaceholder("Mateja").fill("Mateja");
    await page.getByRole("button", { name: "Stvori svoj prostor" }).click();

    await expect(page.getByRole("link", { name: "Kalendar", exact: true })).toBeVisible();
    expect((await backend.counts()).create).toBe(1);
    expect((await backend.counts()).accept).toBe(0);
  });

  test("B: a pending invitation is only shown, never silently accepted", async ({ page }) => {
    const backend = await setupBackend(page, {
      familyId: null,
      members: [],
      invite: { id: "inv-1", family_id: "family-other", family_name: "Obitelj Druga", role: "child" },
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Imaš poziv." })).toBeVisible();
    await expect(page.getByText("Obitelj Druga")).toBeVisible();
    await expect(page.getByText("dijete")).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    // Cross-family guard: no join happened just by opening the app.
    expect((await backend.counts()).accept).toBe(0);
  });

  test("C: explicitly accepting the invitation joins the family and opens the app", async ({ page }) => {
    const backend = await setupBackend(page, {
      familyId: null,
      members: [],
      invite: { id: "inv-1", family_id: "family-other", family_name: "Obitelj Druga", role: "parent" },
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Prihvati pozivnicu" }).click();

    await expect(page.getByRole("link", { name: "Kalendar", exact: true })).toBeVisible();
    const counts = await backend.counts();
    expect(counts.accept).toBe(1);
    // The accepted invitation is exactly the one that was rendered.
    expect(counts.acceptedId).toBe("inv-1");
  });

  test("D: declining the invitation falls back to creating an own space", async ({ page }) => {
    const backend = await setupBackend(page, {
      familyId: null,
      members: [],
      invite: { id: "inv-1", family_id: "family-other", family_name: "Obitelj Druga", role: "parent" },
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Ne, stvori svoj prostor" }).click();

    await expect(page.getByRole("heading", { name: "Tu si." })).toBeVisible();
    expect((await backend.counts()).accept).toBe(0);
  });

  test("E: an invited member without a name is asked for it before the app renders", async ({ page }) => {
    await setupBackend(page, {
      familyId: "family-1",
      invite: null,
      members: [member("")],
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Kako se zoveš?" })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("F: an existing member goes straight into the app", async ({ page }) => {
    await setupBackend(page, {
      familyId: "family-1",
      invite: null,
      members: [member("Mateja")],
    });

    await page.goto("/");

    await expect(page.getByRole("link", { name: "Kalendar", exact: true })).toBeVisible();
  });
});
