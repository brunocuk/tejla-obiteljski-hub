-- Faza 1: evidencija prihvata Uvjeta koristenja i Pravila privatnosti
-- (verzija dokumenta + vrijeme + nacin), obecano u GDPR upitnicima 28.10. i
-- 11.11. Zapise radi iskljucivo server (service_role): kod beta redeema,
-- nakon registracije kroz obiteljsku pozivnicu te kod ponovne potvrde nakon
-- promjene verzije dokumenata. Klijent smije samo citati vlastite zapise.
-- Svaki prihvat je novi red (povijest se cuva); brisanjem racuna nestaju i
-- zapisi (isti obrazac kao privola na landingu).
create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_version text not null,
  method text not null,
  accepted_at timestamptz not null default now()
);
create index legal_acceptances_user_version
  on public.legal_acceptances (user_id, doc_version);

grant select on public.legal_acceptances to authenticated;
grant all on public.legal_acceptances to service_role;
alter table public.legal_acceptances enable row level security;

create policy "Users can view their own legal acceptances"
  on public.legal_acceptances for select to authenticated
  using (user_id = auth.uid());
