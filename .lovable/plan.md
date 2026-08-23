# Brisanje računa (GDPR)

## Što se briše (trajno)

Za korisnika koji traži brisanje:

- Auth račun (prijava više nije moguća) i njegov profil (ime, e-mail)
- Njegovo članstvo u obiteljskom prostoru
- Njegove push pretplate i tokeni uređaja
- Njegove obavijesti (zapisi i isporuke)
- Osobne postavke vidljivosti vezane uz njega
- Pozivnice koje su njemu poslane ili koje je on poslao, a još čekaju

## Što ostaje

Ako u obitelji ima drugih ljudi:

- Obiteljski prostor, članovi i svi događaji/zadaci ostaju netaknuti
- Osoba koja odlazi se skida s budućih obaveza; povijest ostaje
- Njegov "član obitelji" zapis se uklanja, ali zajednički zapisi ostaju drugima

Ako je jedini korisnik prostora: briše se cijeli obiteljski prostor (događaji, zadaci, podsjetnici, članovi, pozivnice), jer postoji samo zbog njega.

## Vlasnik obitelji

- Ako je korisnik vlasnik i u prostoru postoji druga odrasla osoba, brisanje se ne izvodi dok se vlasništvo ne prenese. UI traži odabir nove odrasle osobe kao vlasnika; prijenos i brisanje idu u jednoj sigurnoj operaciji.
- Ako su ostali samo djeca-računi (nema drugog odraslog), korisnik mora prvo ukloniti te članove ili im dati odraslu ulogu — poruka to jasno objašnjava.
- Ako je jedini korisnik, prostor se briše zajedno s računom.

## Sigurnost

Brisanje se izvodi na poslužitelju uz provjeru prijavljenog korisnika; korisnik može obrisati isključivo vlastiti račun. Servisni ključ nikad ne ide u preglednik.

## UI (u Članovi → tvoj račun, ispod "Odjavi se")

1. Diskretan gumb "Obriši račun"
2. Ekran s jasnim upozorenjem što nestaje, a što ostaje obitelji
3. Ako treba, odabir novog vlasnika
4. Potvrda upisom riječi `OBRIŠI` pa gumb "Trajno obriši račun"

Nakon brisanja: odjava, čišćenje Tejlinih podataka iz lokalne pohrane, povratak na ekran prijave.

## Tehnički

- Migracija: `delete_my_account(_new_owner_user_id uuid)` (SECURITY DEFINER, radi na `auth.uid()`) + preflight `account_deletion_preview()` koji vraća je li korisnik vlasnik, ima li kandidata za vlasnika i briše li se prostor.
- Server funkcija `deleteMyAccount` (`src/lib/account.functions.ts`) s `requireSupabaseAuth`: poziva RPC kao korisnik, zatim `supabaseAdmin.auth.admin.deleteUser(userId)` (učitan unutar handlera).
- UI: novi `src/components/DeleteAccountSheet.tsx`, otvara se iz `src/routes/_authenticated/obitelj.tsx`. Bez promjena vizualnog identiteta.

## Testovi

Vitest + SQL provjere za 4 scenarija: obični član, vlasnik uz drugog odraslog (prijenos), jedini korisnik (prostor se briše), pokušaj brisanja tuđeg računa (odbijeno).
