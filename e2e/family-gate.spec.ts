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

/** Fakes an authenticated Supabase session + all backend reads the gate performs. */
async function setupBackend(page: Page, scenario: Scenario) {
  const state = { ...scenario };
  const calls = { accept: 0, create: 0 };

  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

  await page.route(`**/${PROJECT_REF}.supabase.co/**`, async (route) => {
    const url = route.request().url();

    if (url.includes("/auth/v1/user")) {
      return route.fulfill(json({ id: USER_ID, email: "beta@tejla.app", aud: "authenticated" }));
    }
    if (url.includes("/rest/v1/family_users")) {
      return route.fulfill(
        json(state.familyId ? [{ family_id: state.familyId, role: "owner" }] : []),
      );
    }
    if (url.includes("/rest/v1/family_members")) {
      return route.fulfill(json(state.members));
    }
    if (url.includes("/rpc/pending_family_invitation")) {
      return route.fulfill(json(state.invite));
    }
    if (url.includes("/rpc/accept_family_invitation")) {
      calls.accept += 1;
      state.familyId = state.invite?.family_id ?? "family-invited";
      state.members = [member("Mateja", state.familyId)];
      return route.fulfill(json(state.familyId));
    }
    if (url.includes("/rpc/create_family")) {
      calls.create += 1;
      state.familyId = "family-new";
      state.members = [member("Mateja", state.familyId)];
      return route.fulfill(json(state.familyId));
    }
    // Everything else the app screens read: empty result set.
    return route.fulfill(json([]));
  });

  await page.goto("/auth");
  await page.evaluate(
    ([key, uid]) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          access_token: "e2e-fake-token",
          refresh_token: "e2e-fake-refresh",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: uid, email: "beta@tejla.app", aud: "authenticated", role: "authenticated" },
        }),
      );
    },
    [STORAGE_KEY, USER_ID] as const,
  );

  return calls;
}

test.describe("FamilyGate onboarding (browser)", () => {
  test("A: new user without an invitation lands on the create-space screen", async ({ page }) => {
    const calls = await setupBackend(page, { familyId: null, invite: null, members: [] });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Tu si." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Stvori svoj prostor" })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    expect(calls.accept).toBe(0);
  });

  test("A2: creating a space opens the app", async ({ page }) => {
    const calls = await setupBackend(page, { familyId: null, invite: null, members: [] });

    await page.goto("/");
    await page.getByPlaceholder("Obitelj Horvat").fill("Obitelj Test");
    await page.getByPlaceholder("Mateja").fill("Mateja");
    await page.getByRole("button", { name: "Stvori svoj prostor" }).click();

    await expect(page.getByRole("link", { name: "Kalendar" })).toBeVisible();
    expect(calls.create).toBe(1);
    expect(calls.accept).toBe(0);
  });

  test("B: a pending invitation is only shown, never silently accepted", async ({ page }) => {
    const calls = await setupBackend(page, {
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
    expect(calls.accept).toBe(0);
  });

  test("C: explicitly accepting the invitation joins the family and opens the app", async ({ page }) => {
    const calls = await setupBackend(page, {
      familyId: null,
      members: [],
      invite: { id: "inv-1", family_id: "family-other", family_name: "Obitelj Druga", role: "parent" },
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Prihvati pozivnicu" }).click();

    await expect(page.getByRole("link", { name: "Kalendar" })).toBeVisible();
    expect(calls.accept).toBe(1);
  });

  test("D: declining the invitation falls back to creating an own space", async ({ page }) => {
    const calls = await setupBackend(page, {
      familyId: null,
      members: [],
      invite: { id: "inv-1", family_id: "family-other", family_name: "Obitelj Druga", role: "parent" },
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Ne, stvori svoj prostor" }).click();

    await expect(page.getByRole("heading", { name: "Tu si." })).toBeVisible();
    expect(calls.accept).toBe(0);
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

    await expect(page.getByRole("link", { name: "Kalendar" })).toBeVisible();
  });
});
