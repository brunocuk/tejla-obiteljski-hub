# Brisanje računa (GDPR) — finalni plan

## 1. Vlasnik obitelji

- Vlasnik s drugom odraslom osobom u prostoru: mora odabrati kome predaje vlasništvo; prijenos i brisanje idu u jednoj operaciji.
- Vlasnik bez druge odrasle osobe (npr. samo dječji računi): **brisanje je blokirano**. Poruka traži da prvo pozove i poveže drugu odraslu osobu. Nikakva promjena dječje uloge u odraslu se ne nudi ni ne radi.
- Vlasnik koji je jedini korisnik prostora (nema drugih računa): prostor se briše zajedno s računom.

## 2. Kako se čuva zajednička povijest

Provjereno u bazi: zapis osobe u obitelji i njezine veze prema događajima brišu se lančano, pa bi izravno brisanje zapisa člana potiho odspojilo tu osobu i s prošlih zajedničkih događaja. Također, događaji i podsjetnici koje je ta osoba unijela u bazi su vezani uz njezin račun i baza ne dopušta brisanje računa dok te veze postoje.

Rješenje kad u obitelji ostaju drugi ljudi:

- Zapis osobe u obitelji **ostaje kao anonimni trag** ("Bivši član"): ime se briše, veza s računom se prekida. Time povijesni zajednički događaji zadržavaju točan sastav sudionika, a osobni podaci nestaju.
- Osoba se skida sa **svih budućih** obaveza i podsjetnika; prošlost ostaje.
- Događaji i podsjetnici koje je unijela ostaju obitelji, ali se autorstvo prenosi na novog vlasnika/preostalu odraslu osobu.
- Njezine pozivnice i zapisi u beta evidenciji gube vezu s računom (anonimiziraju se), a nedovršene pozivnice se otkazuju.
- Ništa što pripada drugim članovima se ne dira.

Kad je korisnik jedini u prostoru: cijeli prostor (događaji, zadaci, podsjetnici, članovi, pozivnice, obavijesti) briše se u cijelosti.

## 3. Dvije faze brisanja bez „poluobrisanog” računa

Brisanje ima dvije nužne faze: podaci u aplikaciji, pa sam račun za prijavu. Da nikad ne ostane pola posla:

- Na početku se upisuje **zahtjev za brisanje** (u tijeku). Račun je od tog trena označen kao u brisanju.
- Zatim se čiste podaci, pa se briše račun za prijavu, pa se zahtjev označava dovršenim.
- Svaki korak je ponovljiv: ako druga faza padne, zahtjev ostaje "u tijeku" i pri sljedećem pokušaju ili sljedećoj prijavi tog korisnika postupak se automatski nastavlja od mjesta gdje je stao i završava odjavom. Ponovno pokretanje na već očišćenim podacima ne radi štetu.
- Korisnik s otvorenim zahtjevom ne može ući u aplikaciju — odmah se dovršava brisanje i vraća ga se na prijavu.

## 4. Što se mijenja u bazi (i zašto)

Postojeće RLS politike, obiteljski model ovlasti, podsjetnici i AI tok se **ne mijenjaju**. Nužne novosti:

- Nova tablica `account_deletion_requests` (evidencija zahtjeva; vlastite RLS politike + GRANT-ovi, samo vlastiti redak čitljiv).
- Nove funkcije `account_deletion_preview()` i `delete_my_account(_new_owner_user_id uuid)` (rade isključivo nad `auth.uid()`).

Ništa se ne briše kaskadno mimo ovoga; postojeća pravila pristupa ostaju ista.

## 5. Sigurnost

Sve se izvodi na poslužitelju uz provjeru prijavljenog korisnika; moguće je obrisati samo vlastiti račun. Servisni ključ nikad ne dolazi do preglednika. Pokušaj brisanja tuđeg računa se odbija.

## 6. UI (Članovi → tvoj račun, ispod „Odjavi se”)

1. Diskretan gumb „Obriši račun”
2. Ekran s jasnim upozorenjem: što trajno nestaje, a što ostaje obitelji
3. Po potrebi odabir nove odrasle osobe kao vlasnika, ili blokada s objašnjenjem
4. Potvrda upisom riječi `OBRIŠI`, pa „Trajno obriši račun”

Nakon brisanja: odjava, čišćenje Tejlinih podataka iz lokalne pohrane, povratak na ekran prijave. Vizualni identitet ostaje nepromijenjen.

## 7. Testovi

Za četiri scenarija: obični član, vlasnik uz drugu odraslu osobu (prijenos vlasništva), jedini korisnik (prostor se briše), pokušaj brisanja tuđeg računa (odbijeno). Dodatno: ponovno pokretanje nedovršenog brisanja i provjera da zajednički povijesni događaji drugih članova ostaju netaknuti.
