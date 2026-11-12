-- Faza 1: Stripe pretplate + centralni backend entitlement.
-- Model: jedna pretplata po obitelji, platitelj je vlasnik obitelji.
-- Pise iskljucivo service_role (webhook/server rute); klijent samo cita
-- status svoje obitelji. Enforcement je iskljucen dok billing_settings.enforced
-- ne postane true (beta korisnici ne smiju izgubiti pristup prije lansiranja).

-- 1) Postavke naplate (singleton; izvor istine i za RLS i za server)
create table public.billing_settings (
  id boolean primary key default true check (id),
  enforced boolean not null default false,
  updated_at timestamptz not null default now()
);
grant select on public.billing_settings to authenticated;
grant all on public.billing_settings to service_role;
alter table public.billing_settings enable row level security;
create policy "Anyone authenticated can read billing settings"
  on public.billing_settings for select to authenticated using (true);
insert into public.billing_settings (id, enforced) values (true, false);

create or replace function public.billing_enforced()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enforced from public.billing_settings where id), false)
$$;
revoke all on function public.billing_enforced() from public;
grant execute on function public.billing_enforced() to authenticated, service_role;

-- 2) Pretplate po obitelji (zrcalo Stripe stanja, sync kroz webhook)
create table public.family_subscriptions (
  family_id uuid primary key references public.families(id) on delete cascade,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  status text not null default 'none' check (status in (
    'none','trialing','active','past_due','canceled','unpaid',
    'incomplete','incomplete_expired','paused'
  )),
  price_id text,
  cancel_at_period_end boolean not null default false,
  current_period_end timestamptz,
  tos_accepted_at timestamptz,
  tos_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.family_subscriptions to authenticated;
grant all on public.family_subscriptions to service_role;
alter table public.family_subscriptions enable row level security;
create policy "Members can view their family subscription"
  on public.family_subscriptions for select to authenticated
  using (public.is_family_member(family_id));

-- 3) Entitlement: obitelj ima pristup dok pretplata traje; past_due dobiva
-- 7 dana pocheka (Stripe retry prozor), otkaz vrijedi do kraja placenog
-- razdoblja. Kad enforcement nije ukljucen, sve obitelji imaju pristup.
create or replace function public.family_has_access(_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.billing_enforced()
    or exists (
      select 1 from public.family_subscriptions
      where family_id = _family_id
        and (
          status in ('trialing','active')
          or (status = 'past_due'
              and coalesce(current_period_end, 'epoch'::timestamptz) > now() - interval '7 days')
          or (status = 'canceled'
              and coalesce(current_period_end, 'epoch'::timestamptz) > now())
        )
    )
$$;
revoke all on function public.family_has_access(uuid) from public;
grant execute on function public.family_has_access(uuid) to authenticated, service_role;

-- Entitlement po korisniku (za server rute koje znaju samo user id): korisnik
-- ima pristup ako mu barem jedna obitelj ima pristup, ili jos nema nijednu
-- obitelj (onboarding i kupnja moraju raditi prije pretplate).
create or replace function public.user_has_access(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    not public.billing_enforced()
    or not exists (select 1 from public.family_users where user_id = _user_id)
    or exists (
      select 1 from public.family_users fu
      where fu.user_id = _user_id and public.family_has_access(fu.family_id)
    )
$$;
revoke all on function public.user_has_access(uuid) from public;
grant execute on function public.user_has_access(uuid) to service_role;

-- 4) Backend autoritativan i na razini baze: bez aktivne pretplate nema
-- KREIRANJA novog sadrzaja (postojece ostaje citljivo; restriktivni policy
-- se AND-a s postojecima i ne dira ih).
create policy "Entitlement gates new events"
  on public.family_events as restrictive for insert to authenticated
  with check (public.family_has_access(family_id));

-- 5) Idempotencija Stripe webhooka: svaki event se obradi tocno jednom.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
grant all on public.stripe_events to service_role;
alter table public.stripe_events enable row level security;

-- 6) FIRA red za racune (kostur za Fazu 3; webhook puni, obrada ide tek po
-- potvrdi racunovode i FIRA_ENABLED flagu). Partial unique indeksi su brana
-- protiv dvostrukog racuna za isti Stripe invoice/refund.
create table public.invoice_jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete set null,
  kind text not null default 'invoice' check (kind in ('invoice','storno')),
  stripe_invoice_id text not null,
  stripe_refund_id text,
  amount_total integer not null,
  currency text not null default 'eur',
  customer_email text,
  status text not null default 'pending' check (status in (
    'pending','processing','issued','failed','skipped'
  )),
  fira_document_id text,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index invoice_jobs_invoice_once
  on public.invoice_jobs (stripe_invoice_id) where kind = 'invoice';
create unique index invoice_jobs_storno_once
  on public.invoice_jobs (stripe_refund_id) where kind = 'storno';
grant all on public.invoice_jobs to service_role;
alter table public.invoice_jobs enable row level security;
