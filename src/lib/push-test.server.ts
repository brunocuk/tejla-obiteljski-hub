import { buildPushPayload } from "@block65/webcrypto-web-push";
import { isAllowedPushEndpoint } from "@/lib/notifications/push-endpoint";

export async function sendTestPushToUser(userId: string) {
  const vapid = {
    subject: process.env["VAPID_SUBJECT"] ?? "mailto:noreply@example.com",
    publicKey: process.env["VAPID_PUBLIC_KEY"] ?? "",
    privateKey: process.env["VAPID_PRIVATE_KEY"] ?? "",
  };
  if (!vapid.publicKey || !vapid.privateKey) return { sent: 0, total: 0 };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  const list = subs ?? [];
  let sent = 0;
  for (const sub of list) {
    if (!isAllowedPushEndpoint(sub.endpoint)) {
      // SSRF guard (Faza 0 V2): never POST outside known push services.
      await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
      continue;
    }
    try {
      const payload = await buildPushPayload(
        {
          data: JSON.stringify({
            title: "Tejla",
            body: "Testna obavijest — podsjetnici rade.",
            url: "/",
            tag: "test",
          }),
          options: { ttl: 300 },
        },
        {
          endpoint: sub.endpoint,
          expirationTime: null,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        vapid,
      );
      const res = await fetch(sub.endpoint, payload as unknown as RequestInit);
      if (res.status === 404 || res.status === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
      } else if (res.ok) {
        sent += 1;
      }
    } catch (err) {
      console.error(
        "[push-test] TEST_PUSH_FAILED",
        (err as { status?: number })?.status ?? "",
        (err as { code?: string })?.code ?? "",
      );
    }
  }
  return { sent, total: list.length };
}
