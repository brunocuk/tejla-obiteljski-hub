import { describe, expect, it } from "vitest";
import {
  familyIdFromSubscription,
  mapSubscriptionToRow,
  normalizeStatus,
} from "./subscription-map";

describe("mapSubscriptionToRow", () => {
  it("maps a basil-shaped subscription (period end on the item)", () => {
    const row = mapSubscriptionToRow({
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      cancel_at_period_end: false,
      items: { data: [{ current_period_end: 1800000000, price: { id: "price_1" } }] },
    });
    expect(row).toEqual({
      stripe_subscription_id: "sub_1",
      stripe_customer_id: "cus_1",
      status: "active",
      price_id: "price_1",
      cancel_at_period_end: false,
      current_period_end: new Date(1800000000 * 1000).toISOString(),
    });
  });

  it("falls back to legacy top-level current_period_end and customer object", () => {
    const row = mapSubscriptionToRow({
      id: "sub_2",
      status: "trialing",
      customer: { id: "cus_2" },
      current_period_end: 1700000000,
      items: { data: [{ price: { id: "price_2" } }] },
    });
    expect(row.stripe_customer_id).toBe("cus_2");
    expect(row.status).toBe("trialing");
    expect(row.current_period_end).toBe(new Date(1700000000 * 1000).toISOString());
  });

  it("handles missing items and period end", () => {
    const row = mapSubscriptionToRow({ id: "sub_3", status: "canceled", customer: "cus_3" });
    expect(row.price_id).toBeNull();
    expect(row.current_period_end).toBeNull();
    expect(row.cancel_at_period_end).toBe(false);
  });

  it("normalizes unknown statuses to none (CHECK constraint ih inace rusi)", () => {
    expect(normalizeStatus("active")).toBe("active");
    expect(normalizeStatus("paused")).toBe("paused");
    expect(normalizeStatus("something_new_from_stripe")).toBe("none");
  });
});

describe("familyIdFromSubscription", () => {
  it("reads family_id from metadata", () => {
    expect(
      familyIdFromSubscription({
        id: "sub_1",
        status: "active",
        customer: "cus_1",
        metadata: { family_id: "fam-1" },
      }),
    ).toBe("fam-1");
  });

  it("returns null when metadata is missing or empty", () => {
    expect(familyIdFromSubscription({ id: "s", status: "active", customer: "c" })).toBeNull();
    expect(
      familyIdFromSubscription({ id: "s", status: "active", customer: "c", metadata: { family_id: "" } }),
    ).toBeNull();
  });
});
