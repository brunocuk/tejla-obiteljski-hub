import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

type UpsertRow = Record<string, unknown>;

const state = {
  eventInsertError: null as null | { code: string },
  upsertError: null as null | { code: string },
  upserts: [] as UpsertRow[],
  eventDeletes: [] as string[],
  invoiceJobs: [] as UpsertRow[],
  lookupFamilyByCustomer: null as string | null,
};

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "stripe_events") {
        return {
          insert: async () => ({ error: state.eventInsertError }),
          delete: () => ({
            eq: async (_col: string, id: string) => {
              state.eventDeletes.push(id);
              return { error: null };
            },
          }),
        };
      }
      if (table === "family_subscriptions") {
        return {
          upsert: async (row: UpsertRow) => {
            state.upserts.push(row);
            return { error: state.upsertError };
          },
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: state.lookupFamilyByCustomer
                  ? { family_id: state.lookupFamilyByCustomer }
                  : null,
              }),
            }),
          }),
        };
      }
      if (table === "invoice_jobs") {
        return {
          insert: async (row: UpsertRow) => {
            state.invoiceJobs.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  },
}));

const SECRET = "whsec_test_tajna";
const stripeForSigning = new Stripe("sk_test_dummy");

function signedRequest(event: Record<string, unknown>): Request {
  const payload = JSON.stringify(event);
  const header = stripeForSigning.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
  });
  return new Request("http://localhost/api/stripe-webhook", {
    method: "POST",
    headers: { "stripe-signature": header },
    body: payload,
  });
}

function subscriptionEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_test_1",
    object: "event",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_1",
        object: "subscription",
        status: "active",
        customer: "cus_1",
        cancel_at_period_end: false,
        metadata: { family_id: "11111111-1111-4111-8111-111111111111" },
        items: { data: [{ current_period_end: 1800000000, price: { id: "price_1" } }] },
        ...overrides,
      },
    },
  };
}

const { handleStripeWebhookRequest } = await import("./webhook.server");

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  state.eventInsertError = null;
  state.upsertError = null;
  state.upserts = [];
  state.eventDeletes = [];
  state.invoiceJobs = [];
  state.lookupFamilyByCustomer = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("handleStripeWebhookRequest", () => {
  it("fails closed (500) when webhook secret is not configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const res = await handleStripeWebhookRequest(signedRequest(subscriptionEvent()));
    expect(res.status).toBe(500);
    expect(state.upserts).toHaveLength(0);
  });

  it("rejects a missing signature with 400", async () => {
    const res = await handleStripeWebhookRequest(
      new Request("http://localhost/api/stripe-webhook", {
        method: "POST",
        body: JSON.stringify(subscriptionEvent()),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects an invalid signature with 400", async () => {
    const payload = JSON.stringify(subscriptionEvent());
    const res = await handleStripeWebhookRequest(
      new Request("http://localhost/api/stripe-webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=deadbeef" },
        body: payload,
      }),
    );
    expect(res.status).toBe(400);
    expect(state.upserts).toHaveLength(0);
  });

  it("syncs subscription state from a signed subscription.updated event", async () => {
    const res = await handleStripeWebhookRequest(signedRequest(subscriptionEvent()));
    expect(res.status).toBe(200);
    expect(state.upserts).toHaveLength(1);
    expect(state.upserts[0]).toMatchObject({
      family_id: "11111111-1111-4111-8111-111111111111",
      stripe_subscription_id: "sub_1",
      stripe_customer_id: "cus_1",
      status: "active",
      price_id: "price_1",
    });
  });

  it("resolves the family through the customer id when metadata is missing", async () => {
    state.lookupFamilyByCustomer = "22222222-2222-4222-8222-222222222222";
    const res = await handleStripeWebhookRequest(
      signedRequest(subscriptionEvent({ metadata: {} })),
    );
    expect(res.status).toBe(200);
    expect(state.upserts[0]).toMatchObject({
      family_id: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("skips processing for a duplicate event id but still returns 200", async () => {
    state.eventInsertError = { code: "23505" };
    const res = await handleStripeWebhookRequest(signedRequest(subscriptionEvent()));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(state.upserts).toHaveLength(0);
  });

  it("releases the event id when processing fails so Stripe can retry", async () => {
    state.upsertError = { code: "XX000" };
    const res = await handleStripeWebhookRequest(signedRequest(subscriptionEvent()));
    expect(res.status).toBe(500);
    expect(state.eventDeletes).toEqual(["evt_test_1"]);
  });

  it("ignores unhandled event types with 200", async () => {
    const res = await handleStripeWebhookRequest(
      signedRequest({
        id: "evt_other",
        object: "event",
        type: "customer.created",
        data: { object: { id: "cus_9", object: "customer" } },
      }),
    );
    expect(res.status).toBe(200);
    expect(state.upserts).toHaveLength(0);
  });

  it("does not enqueue FIRA jobs while FIRA_ENABLED is off", async () => {
    const res = await handleStripeWebhookRequest(
      signedRequest({
        id: "evt_inv_1",
        object: "event",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_1",
            object: "invoice",
            amount_paid: 500,
            currency: "eur",
            customer: "cus_1",
            customer_email: "kupac@example.com",
          },
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(state.invoiceJobs).toHaveLength(0);
  });

  it("enqueues an idempotent FIRA invoice job when FIRA_ENABLED is on", async () => {
    vi.stubEnv("FIRA_ENABLED", "true");
    state.lookupFamilyByCustomer = "33333333-3333-4333-8333-333333333333";
    const res = await handleStripeWebhookRequest(
      signedRequest({
        id: "evt_inv_2",
        object: "event",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_2",
            object: "invoice",
            amount_paid: 500,
            currency: "eur",
            customer: "cus_1",
            customer_email: "kupac@example.com",
          },
        },
      }),
    );
    expect(res.status).toBe(200);
    expect(state.invoiceJobs).toHaveLength(1);
    expect(state.invoiceJobs[0]).toMatchObject({
      kind: "invoice",
      stripe_invoice_id: "in_2",
      amount_total: 500,
      customer_email: "kupac@example.com",
      family_id: "33333333-3333-4333-8333-333333333333",
    });
  });
});
