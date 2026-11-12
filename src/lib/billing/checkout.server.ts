import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestUserId } from "@/lib/api-auth.server";
import { LEGAL_VERSION } from "@/lib/legal";
import { appBaseUrl, getStripe, priceIdFor, trialDays } from "./stripe.server";

type BillingBody = { familyId?: unknown; interval?: unknown };

/** Vlasnik obitelji, ili null. Pretplatom upravlja iskljucivo vlasnik (platitelj). */
async function assertOwner(request: Request, familyId: string): Promise<string | null> {
  const userId = await getRequestUserId(request);
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from("family_users")
    .select("role")
    .eq("family_id", familyId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "owner" ? userId : null;
}

function parseBody(raw: unknown): { familyId: string; interval: "monthly" | "yearly" } | null {
  const body = (raw ?? {}) as BillingBody;
  const familyId = typeof body.familyId === "string" ? body.familyId : "";
  if (!/^[0-9a-f-]{36}$/i.test(familyId)) return null;
  const interval = body.interval === "yearly" ? "yearly" : "monthly";
  return { familyId, interval };
}

export async function handleCheckoutRequest(request: Request): Promise<Response> {
  let parsed: ReturnType<typeof parseBody>;
  try {
    parsed = parseBody(await request.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return Response.json({ error: "Neispravan zahtjev" }, { status: 400 });

  const userId = await assertOwner(request, parsed.familyId);
  if (!userId) {
    return Response.json(
      { error: "Samo vlasnik obitelji može upravljati pretplatom." },
      { status: 403 },
    );
  }

  const priceId = priceIdFor(parsed.interval);
  if (!priceId) {
    console.error("BILLING_CONFIG_ERROR missing price id", parsed.interval);
    return Response.json({ error: "Naplata još nije konfigurirana." }, { status: 500 });
  }

  const { data: existing } = await supabaseAdmin
    .from("family_subscriptions")
    .select("stripe_customer_id, status")
    .eq("family_id", parsed.familyId)
    .maybeSingle();

  if (existing && ["active", "trialing", "past_due"].includes(existing.status)) {
    return Response.json(
      { error: "Pretplata za ovu obitelj već postoji. Koristi Upravljaj pretplatom." },
      { status: 409 },
    );
  }

  const stripe = getStripe();

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userData?.user?.email;
    const customer = await stripe.customers.create({
      ...(email ? { email } : {}),
      metadata: { family_id: parsed.familyId },
    });
    customerId = customer.id;
    // Red se kreira odmah (status none): webhook kasnije uvijek moze naci
    // obitelj po customer id-u cak i bez metadata na pretplati.
    const { error } = await supabaseAdmin
      .from("family_subscriptions")
      .upsert(
        { family_id: parsed.familyId, stripe_customer_id: customerId, status: "none" },
        { onConflict: "family_id" },
      );
    if (error) {
      console.error("BILLING_CUSTOMER_STORE_ERROR", error.code);
      return Response.json({ error: "Greška pri pripremi naplate." }, { status: 500 });
    }
  }

  const base = appBaseUrl();
  const trial = trialDays();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/obitelj?pretplata=uspjeh`,
    cancel_url: `${base}/obitelj?pretplata=odustanak`,
    locale: "hr",
    client_reference_id: parsed.familyId,
    metadata: { family_id: parsed.familyId },
    subscription_data: {
      metadata: { family_id: parsed.familyId },
      ...(trial ? { trial_period_days: trial } : {}),
    },
    // Prihvat uvjeta pretplate: checkbox u Stripe Checkoutu (trazi ToS URL u
    // Stripe postavkama), evidencija se sprema iz webhooka (tos_accepted_at).
    ...(process.env["STRIPE_COLLECT_TOS"] === "true"
      ? { consent_collection: { terms_of_service: "required" as const } }
      : {}),
  });

  if (!session.url) {
    console.error("BILLING_CHECKOUT_NO_URL", session.id);
    return Response.json({ error: "Greška pri pokretanju naplate." }, { status: 500 });
  }
  return Response.json({ url: session.url, tosVersion: LEGAL_VERSION });
}

export async function handlePortalRequest(request: Request): Promise<Response> {
  let parsed: ReturnType<typeof parseBody>;
  try {
    parsed = parseBody(await request.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return Response.json({ error: "Neispravan zahtjev" }, { status: 400 });

  const userId = await assertOwner(request, parsed.familyId);
  if (!userId) {
    return Response.json(
      { error: "Samo vlasnik obitelji može upravljati pretplatom." },
      { status: 403 },
    );
  }

  const { data: row } = await supabaseAdmin
    .from("family_subscriptions")
    .select("stripe_customer_id")
    .eq("family_id", parsed.familyId)
    .maybeSingle();
  if (!row?.stripe_customer_id) {
    return Response.json({ error: "Za ovu obitelj još nema pretplate." }, { status: 404 });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: `${appBaseUrl()}/obitelj`,
  });
  return Response.json({ url: session.url });
}
