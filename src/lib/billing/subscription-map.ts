/**
 * Mapiranje Stripe pretplate u red family_subscriptions. Namjerno radi nad
 * strukturnim tipom, a ne nad Stripe.Subscription: novije Stripe API verzije
 * (basil) drze current_period_end na stavci pretplate, starije na samoj
 * pretplati, pa pokrivamo oba oblika.
 */

export const KNOWN_STATUSES = new Set([
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

export type StripeSubscriptionLike = {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end?: boolean | null;
  metadata?: Record<string, string> | null;
  current_period_end?: number | null;
  items?: {
    data?: Array<{
      current_period_end?: number | null;
      price?: { id?: string | null } | null;
    }> | null;
  } | null;
};

export type SubscriptionRow = {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  status: string;
  price_id: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
};

export function normalizeStatus(status: string): string {
  return KNOWN_STATUSES.has(status) ? status : "none";
}

export function mapSubscriptionToRow(sub: StripeSubscriptionLike): SubscriptionRow {
  const item = sub.items?.data?.[0];
  const periodEndUnix = item?.current_period_end ?? sub.current_period_end ?? null;
  return {
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    status: normalizeStatus(sub.status),
    price_id: item?.price?.id ?? null,
    cancel_at_period_end: sub.cancel_at_period_end === true,
    current_period_end:
      typeof periodEndUnix === "number" && Number.isFinite(periodEndUnix)
        ? new Date(periodEndUnix * 1000).toISOString()
        : null,
  };
}

export function familyIdFromSubscription(sub: StripeSubscriptionLike): string | null {
  const familyId = sub.metadata?.["family_id"];
  return typeof familyId === "string" && familyId.length > 0 ? familyId : null;
}
