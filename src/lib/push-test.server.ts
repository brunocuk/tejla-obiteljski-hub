import { buildPushPayload } from "@block65/webcrypto-web-push";

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
      console.error("test push failed", err);
    }
  }
  return { sent, total: list.length };
}
