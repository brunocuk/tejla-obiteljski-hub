import Stripe from "stripe";

let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY nije postavljen");
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env["STRIPE_SECRET_KEY"]);
}

/** Javna baza aplikacije za povratne URL-ove iz Stripe tokova. */
export function appBaseUrl(): string {
  return (process.env["APP_BASE_URL"] ?? "https://app.tejla.app").replace(/\/+$/, "");
}

export function priceIdFor(interval: "monthly" | "yearly"): string | null {
  const id =
    interval === "yearly"
      ? process.env["STRIPE_PRICE_YEARLY"]
      : process.env["STRIPE_PRICE_MONTHLY"];
  return id && id.length > 0 ? id : null;
}

/** Trial u danima; odluka jos nije pala pa je konfigurabilan (0/prazno = bez triala). */
export function trialDays(): number | null {
  const raw = process.env["STRIPE_TRIAL_DAYS"];
  if (!raw) return null;
  const days = Number(raw);
  return Number.isInteger(days) && days > 0 ? days : null;
}
