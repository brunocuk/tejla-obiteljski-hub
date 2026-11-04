-- Faza 0 nalaz V2 (SSRF kroz push endpoint): push_subscriptions.endpoint
-- upisuje klijent direktno (PostgREST + RLS), a server kasnije POST-a na taj
-- URL iz cron joba. Constraint ogranicava endpoint na poznate browser push
-- servise; aplikacijska allowlista pri slanju (src/lib/notifications/
-- push-endpoint.ts) je drugi sloj i mora ostati uskladjena s ovim regexom.
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_allowlist check (
    endpoint ~* '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)+notify\.windows\.com)(/|$)'
  );
