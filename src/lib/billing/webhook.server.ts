import type Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LEGAL_VERSION } from "@/lib/legal";
import {
  familyIdFromSubscription,
  mapSubscriptionToRow,
  type StripeSubscriptionLike,
} from "./subscription-map";
import { getStripe } from "./stripe.server";

/**
 * Stripe webhook: verifikacija potpisa + idempotencija kroz stripe_events
 * (svaki event se obradi tocno jednom; replay vraca 200 bez obrade).
 * Stanje pretplate se uvijek izvodi iz Stripe objekta (upsert), pa je i sama
 * obrada sigurna na ponavljanje.
 */
export async function handleStripeWebhookRequest(request: Request): Promise<Response> {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret || !process.env["STRIPE_SECRET_KEY"]) {
    console.error("STRIPE_WEBHOOK_NOT_CONFIGURED");
    return Response.json({ error: "Webhook nije konfiguriran" }, { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Nedostaje potpis" }, { status: 400 });

  const payload = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return Response.json({ error: "Potpis nije valjan" }, { status: 400 });
  }

  const stored = await supabaseAdmin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (stored.error) {
    if (stored.error.code === "23505") {
      return Response.json({ received: true, duplicate: true });
    }
    console.error("STRIPE_EVENT_STORE_ERROR", stored.error.code);
    return Response.json({ error: "Spremanje eventa nije uspjelo" }, { status: 500 });
  }

  try {
    await handleEvent(stripe, event);
  } catch (err) {
    // Obrada pala nakon upisa: makni zapis da Stripeov retry prodje ponovno.
    await supabaseAdmin.from("stripe_events").delete().eq("id", event.id);
    console.error("STRIPE_WEBHOOK_HANDLER_ERROR", event.type, (err as Error).message);
    return Response.json({ error: "Obrada nije uspjela" }, { status: 500 });
  }

  return Response.json({ received: true });
}

async function handleEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const familyId = session.client_reference_id ?? session.metadata?.["family_id"] ?? null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (!subscriptionId) return;
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const tosAccepted = session.consent?.terms_of_service === "accepted";
      await upsertSubscription(sub as unknown as StripeSubscriptionLike, familyId, {
        ...(tosAccepted
          ? { tos_accepted_at: new Date().toISOString(), tos_version: LEGAL_VERSION }
          : {}),
      });
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as unknown as StripeSubscriptionLike;
      await upsertSubscription(sub, familyIdFromSubscription(sub));
      return;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const subscriptionId = subscriptionIdFromInvoice(invoice);
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(
          sub as unknown as StripeSubscriptionLike,
          familyIdFromSubscription(sub as unknown as StripeSubscriptionLike),
        );
      }
      if (event.type === "invoice.payment_succeeded") {
        await enqueueInvoiceJob(invoice);
      }
      return;
    }
    case "charge.refunded": {
      await enqueueStornoJobs(event.data.object);
      return;
    }
    default:
      return;
  }
}

/** Invoice → subscription id; basil API ga drzi u parent.subscription_details. */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null })
    .subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object") return legacy.id;
  const parent = (
    invoice as unknown as {
      parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
    }
  ).parent;
  const viaParent = parent?.subscription_details?.subscription;
  if (typeof viaParent === "string") return viaParent;
  if (viaParent && typeof viaParent === "object") return viaParent.id;
  return null;
}

async function upsertSubscription(
  sub: StripeSubscriptionLike,
  familyId: string | null,
  extra: Record<string, string> = {},
): Promise<void> {
  const row = mapSubscriptionToRow(sub);
  let targetFamily = familyId;
  if (!targetFamily) {
    const { data } = await supabaseAdmin
      .from("family_subscriptions")
      .select("family_id")
      .eq("stripe_customer_id", row.stripe_customer_id)
      .maybeSingle();
    targetFamily = data?.family_id ?? null;
  }
  if (!targetFamily) {
    // Bez obitelji nema reda: event je vjerojatno iz rucnog testa u dashboardu.
    console.error("STRIPE_SYNC_NO_FAMILY", row.stripe_subscription_id);
    return;
  }
  const { error } = await supabaseAdmin.from("family_subscriptions").upsert(
    { family_id: targetFamily, ...row, ...extra, updated_at: new Date().toISOString() },
    { onConflict: "family_id" },
  );
  if (error) throw new Error(`family_subscriptions upsert: ${error.code}`);
}

/** FIRA red (Faza 3): puni se samo uz FIRA_ENABLED; dupli insert je no-op. */
async function enqueueInvoiceJob(invoice: Stripe.Invoice): Promise<void> {
  if (process.env["FIRA_ENABLED"] !== "true") return;
  if (!invoice.id || !invoice.amount_paid) return;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const { data: subRow } = customerId
    ? await supabaseAdmin
        .from("family_subscriptions")
        .select("family_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle()
    : { data: null };
  const { error } = await supabaseAdmin.from("invoice_jobs").insert({
    kind: "invoice",
    stripe_invoice_id: invoice.id,
    amount_total: invoice.amount_paid,
    currency: invoice.currency ?? "eur",
    customer_email: invoice.customer_email,
    family_id: subRow?.family_id ?? null,
  });
  if (error && error.code !== "23505") throw new Error(`invoice_jobs insert: ${error.code}`);
}

async function enqueueStornoJobs(charge: Stripe.Charge): Promise<void> {
  if (process.env["FIRA_ENABLED"] !== "true") return;
  const invoiceId =
    typeof (charge as unknown as { invoice?: string | { id: string } | null }).invoice === "string"
      ? ((charge as unknown as { invoice: string }).invoice)
      : ((charge as unknown as { invoice?: { id: string } | null }).invoice?.id ?? null);
  if (!invoiceId) return;
  const refunds = charge.refunds?.data ?? [];
  for (const refund of refunds) {
    const { error } = await supabaseAdmin.from("invoice_jobs").insert({
      kind: "storno",
      stripe_invoice_id: invoiceId,
      stripe_refund_id: refund.id,
      amount_total: refund.amount,
      currency: refund.currency ?? "eur",
    });
    if (error && error.code !== "23505") throw new Error(`invoice_jobs storno: ${error.code}`);
  }
}
