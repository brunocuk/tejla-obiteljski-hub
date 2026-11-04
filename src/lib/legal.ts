// Pravila privatnosti i Uvjeti korištenja za zatvorenu betu.
// Tekst je preuzet doslovno iz dokumenta HAJDI obrta (3.11.2026.); mijenjati
// ga smije samo nova verzija dokumenta, uz podizanje LEGAL_VERSION.

export const LEGAL_VERSION = "BETA 1.0";

export type LegalSection = {
  title: string;
  body: string;
};

export const LEGAL_INTRO =
  "Ovaj dokument odnosi se na zatvoreno testiranje aplikacije Tejla s pozvanim korisnicima. Pravila privatnosti i Uvjeti korištenja navedeni su kao dva zasebna teksta.";

export const PRIVACY_TITLE = "Pravila privatnosti";

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "1. Tko je voditelj obrade",
    body: "HAJDI, obrt za usluge, vlasnik Davor Hajdinjak, Zeleni vijenac 30, 10360 Sesvete, OIB 89980085111 (dalje: „HAJDI” ili „mi”), voditelj je obrade osobnih podataka u aplikaciji Tejla. Za pitanja i ostvarivanje prava: tejla@tejla.app. Tejla je web-aplikacija dostupna putem app.tejla.app. Podaci prijave na listu ranog pristupa putem www.tejla.app obrađuju se odvojeno, prema informacijama na toj stranici; prijava na listu sama po sebi ne otvara račun u aplikaciji.",
  },
  {
    title: "2. Koje podatke obrađujemo",
    body: "Podaci o računu: e-mail adresa, lozinka u obliku sigurnosnog sažetka, ime ako ga korisnik unese, identifikator računa, podaci o potvrdi e-pošte i tehnički podaci prijave. Podaci o obitelji: nazivi i imena članova, uloge, pozivnice, povezivanje članova, postavke vidljivosti dječjih profila. Sadržaj: zadaci, događaji, popisi, opisi, bilješke, datumi, ponavljanja, dodjele, podsjetnici i informacije koje korisnik sam upiše. AI ulaz: fotografije i snimke zaslona, PDF, tekst ili audiozapis koji korisnik odabere za obradu, kao i nužan kontekst (trenutačni datum i vrijeme, ime osobe koja unosi sadržaj te imena članova obitelji potrebna za predlaganje dodjele). Tehnički podaci: podaci o uređaju i pregledniku, IP adresa u nužnim sigurnosnim zapisima, push pretplatnički token i zapisi slanja servisnih poruka.",
  },
  {
    title: "3. Zašto obrađujemo podatke i na kojoj osnovi",
    body: "Račun, autentikacija, obiteljske funkcije, spremanje i prikaz obveza, odabrana AI obrada i servisne obavijesti nužni su za pružanje usluge koju korisnik zatraži (čl. 6. st. 1. t. (b) GDPR-a), u opsegu u kojem se podaci odnose na ugovornu stranu. Sigurnost sustava, sprječavanje zlouporabe i rješavanje tehničkih problema temelje se na legitimnom interesu (čl. 6. st. 1. t. (f)), nakon odgovarajuće procjene. Za pojedine neobvezne poruke, ako ih omogućimo, tražit ćemo zasebnu privolu (čl. 6. st. 1. t. (a)). Podaci drugih osoba koje korisnik unosi, uključujući djecu i osobe spomenute u dokumentima, zahtijevaju zasebnu procjenu pravne osnove i transparentnosti prije uključivanja takve obrade. Posebne kategorije podataka ne smiju se obrađivati bez dodatne primjenjive iznimke iz čl. 9 GDPR-a; sama ugovorna osnova nije dovoljna.",
  },
  {
    title: "4. AI obrada fotografija, PDF-ova, teksta i glasa",
    body: "Kad korisnik odabere sadržaj za AI prepoznavanje, šaljemo ga pružatelju AI usluge radi predlaganja zadataka i događaja, odnosno prijepisa govora. Prijedlog se prikazuje korisniku koji odlučuje što će spremiti; nema automatiziranih odluka s pravnim ili sličnim značajnim učinkom. Izvorne fotografije, PDF-ovi i audiozapisi prema opisanom tehničkom modelu ne pohranjuju se trajno u našoj aplikacijskoj bazi; potvrđeni zadaci i događaji ostaju spremljeni. Za AI obradu koristimo Microsoft Azure OpenAI: tekst/slike/PDF u konfiguraciji Sweden Central, a glasovni prijepis putem modela gpt-4o-mini-transcribe u konfiguraciji Global Standard, pri čemu se obrada može odvijati izvan EU. Pružatelj može privremeno čuvati sadržaj radi nadzora zlouporabe, do 30 dana, ovisno o stvarnim postavkama i eventualnom odobrenju izuzeća. Sadržaj se ne koristi za treniranje Microsoftovih temeljnih modela prema uvjetima ove usluge.",
  },
  {
    title: "5. Obitelj, dijeljenje i djeca",
    body: "Odrasli korisnik može kreirati obiteljsku grupu, pozvati druge odrasle članove i dodati dječje profile. Odrasli članovi s odgovarajućim ulogama mogu vidjeti zajedničke zadatke i događaje; vidljivost dječjeg profila ograničava se prema postavkama koje odrede odrasli. Dječji profil bez vlastite prijave sadržava podatke koje unese odrasli. Tehnički model predviđa i zasebnu prijavu djeteta na poziv odraslog, ali bez provjere dobi i formalne potvrde roditeljskog ovlaštenja. Tijekom ove bete zasebni dječji računi s vlastitom prijavom nisu namijenjeni korištenju; dječjim profilima upravljaju odrasli članovi. Osoba koja dodaje podatke drugih članova treba imati pravo dijeliti te podatke i izbjegavati unos nepotrebnih detalja.",
  },
  {
    title: "6. Osjetljivi sadržaj",
    body: "Tejla nije medicinska usluga. Molimo da tijekom bete ne učitavate zdravstvene nalaze, podatke o zdravlju, vjeri, političkim uvjerenjima ili druge posebno osjetljive dokumente, niti dokumente drugih osoba bez odgovarajućeg ovlaštenja. Sustav možda neće automatski prepoznati niti blokirati takve dokumente. Molimo da ih ne šaljete putem AI funkcije.",
  },
  {
    title: "7. Pružatelji usluga i prijenosi",
    body: "Za bazu i prijavu koristimo Supabase (projekt u regiji eu-west-1, Irska); za hosting Vercel; za servisne e-poruke Resend; za AI obradu nakon migracije Microsoft Azure; za razvoj i tehničko održavanje Progmatiq / Ninefold. Web push poruke mogu prolaziti kroz infrastrukturu preglednika i operacijskih sustava (npr. Apple, Google, Mozilla). Određeni pružatelji i njihovi podizvršitelji mogu obrađivati podatke izvan Europskog gospodarskog prostora, uključujući SAD; prijenosi se provode uz odgovarajuće zaštitne mjere prema primjenjivim ugovorima i propisima (primjerice odluku o primjerenosti ili standardne ugovorne klauzule). Informacije o njima možete zatražiti na tejla@tejla.app.",
  },
  {
    title: "8. Podsjetnici, e-pošta i kolačići",
    body: "Ako korisnik omogući push obavijesti u pregledniku, Tejla koristi push token za dostavu generičkih podsjetnika. Prema opisanom modelu sadržaj obavijesti ne uključuje naziv zadatka ni ime člana obitelji. Push se može isključiti u postavkama preglednika. Servisne poruke služe potvrdi računa, pozivnicama, sigurnosti i funkcioniranju usluge. Ne provodimo oglašivačko praćenje ni bihevioralnu analitiku prema trenutačno opisanom stanju. Koristimo nužne podatke sesije i lokalnu pohranu potrebnu za prijavu i rad aplikacije; ako se kasnije uvedu neobvezne tehnologije praćenja, pravila i način prikupljanja privole ažurirat će se prije aktivacije.",
  },
  {
    title: "9. Koliko čuvamo podatke",
    body: "Podaci o računu i sadržaju ostaju dok postoji račun odnosno dok ih korisnik ili ovlašteni član ne izbriše. Zajednički zadaci mogu ostati vidljivi drugim članovima obitelji i nakon izlaska jednog člana, uz uklanjanje ili ograničavanje identifikacijskih podataka gdje je to potrebno. Tehnički logovi i sigurnosne kopije prema opisanom modelu čuvaju se do 30 dana; zapisi e-pošte u Resendu približno do 30 dana. Izvorne AI datoteke ne čuvamo trajno u vlastitoj bazi, no pružatelj AI-ja može privremeno zadržati ulazne i izlazne podatke do 30 dana radi sigurnosti. Podatke iz zahtjeva korisničkoj podršci čuvamo samo koliko je potrebno za rješavanje zahtjeva i eventualnu zaštitu pravnih zahtjeva, uz redovitu provjeru potrebe za čuvanjem. Podaci prijava na listu ranog pristupa čuvaju se prema zasebnim Pravilima te liste.",
  },
  {
    title: "10. Brisanje i prava korisnika",
    body: "Korisnik može zatražiti pristup, ispravak, brisanje, ograničenje, prenosivost kada je primjenjiva, prigovor na obradu temeljenu na legitimnom interesu i povlačenje privole bez utjecaja na prethodnu zakonitost. Zahtjev se šalje na tejla@tejla.app. Odgovaramo bez nepotrebnog odgađanja, u pravilu najkasnije u roku od mjesec dana, uz zakonski dopušteno produljenje. Korisnik može podnijeti pritužbu Agenciji za zaštitu osobnih podataka (AZOP), www.azop.hr. Brisanje računa ne znači nužno trenutačno uklanjanje svih kopija iz sigurnosnih kopija, a sadržaj zajedničke obitelji može ostati u mjeri koja je zakonita i nužna za ostale članove.",
  },
  {
    title: "11. Sigurnost i izmjene",
    body: "Koristimo kontrolu pristupa, odvajanje korisničkih ovlasti u bazi, enkripciju prijenosa i druge tehničke i organizacijske mjere. Nijedna internetska usluga ne može jamčiti potpunu sigurnost. O bitnim izmjenama ovih Pravila obavijestit ćemo korisnike primjerenim putem. Verzija: BETA 1.0. Pravila se primjenjuju od trenutka kada su objavljena u aplikaciji.",
  },
];

export const TERMS_TITLE = "Uvjeti korištenja";

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "1. Pružatelj i svrha testiranja",
    body: "Tejlu pruža HAJDI, obrt za usluge, vlasnik Davor Hajdinjak, Zeleni vijenac 30, 10360 Sesvete, OIB 89980085111, kontakt tejla@tejla.app. Tejla je web-aplikacija za pohranu i dijeljenje obiteljskih zadataka, događaja i drugih informacija, uključujući prijedloge iz korisnički unesenog sadržaja. Tijekom zatvorene bete pristup imaju samo pozvani testeri, a korištenje je besplatno. Cilj je provjera funkcionalnosti i prikupljanje povratnih informacija.",
  },
  {
    title: "2. Registracija i pristup",
    body: "Korisnik se registrira putem pozivnice ili drugog načina pristupa koji je omogućen za zatvorenu betu, unosi točne podatke i štiti svoje pristupne podatke. Zaštita računa uključuje čuvanje lozinke i pravodobnu prijavu sumnje na neovlašten pristup. Tejla može privremeno ograničiti pristup radi sigurnosti ili ozbiljne zlouporabe, uz primjereno obavještavanje kada je moguće. Pri registraciji korisnik mora imati pristup ovim Uvjetima i Pravilima privatnosti. Prihvaćanjem ovih Uvjeta tijekom registracije potvrđujete da ste ih pročitali i prihvatili.",
  },
  {
    title: "3. Obiteljski računi i vidljivost",
    body: "Korisnik može otvoriti obiteljsku grupu i pozvati druge odrasle članove. Članovi s odgovarajućim ulogama mogu vidjeti i uređivati zajedničke podatke, a dječji profili vide sadržaj prema ovlastima koje postave odrasli. Prije dodavanja članova i sadržaja drugih osoba korisnik treba provjeriti ima li za to odgovarajuće ovlaštenje. Poziv u obitelj treba poslati samo osobi kojoj je namijenjen. Tijekom ove bete dječje profile otvaraju i njima upravljaju odrasli; samostalne prijave djece nisu dio dopuštenog testiranja.",
  },
  {
    title: "4. AI obrada i odgovornost za unos",
    body: "Korisnik može dobrovoljno poslati fotografiju, PDF, tekst ili glasovni zapis radi izdvajanja prijedloga zadataka ili prijepisa govora. AI može pogriješiti u datumima, imenima, rokovima ili značenju poruke. Korisnik mora pregledati prijedlog prije spremanja i ne smije se osloniti na AI bez provjere kada je riječ o važnim informacijama. Tijekom bete ne treba učitavati zdravstvene nalaze, posebno osjetljive dokumente ni podatke drugih osoba bez odgovarajućeg ovlaštenja. Tejla nije medicinski, pravni ni hitni servis.",
  },
  {
    title: "5. Podsjetnici i dostupnost",
    body: "Podsjetnici ovise o dozvolama preglednika, mreži, uređaju i postavkama operacijskog sustava. Ne jamčimo da će svaki podsjetnik biti dostavljen u točno određeno vrijeme ili vidljiv na zaključanom zaslonu. Beta može imati prekide, pogreške, privremeno nedostupne funkcije ili promjene izgleda. Za kritične obveze korisnik treba imati dodatni način provjere.",
  },
  {
    title: "6. Pravila dopuštenog korištenja",
    body: "Zabranjeno je pokušavati pristupiti tuđim računima, zaobilaziti kontrole pristupa, namjerno preopterećivati sustav, unositi zlonamjerni sadržaj, koristiti uslugu protivno zakonu ili kršiti prava drugih. Korisnik zadržava prava na svoj sadržaj, a HAJDI ga obrađuje u opsegu nužnom za pružanje usluge i prema Pravilima privatnosti. Ne prodajemo korisnički sadržaj oglašivačima.",
  },
  {
    title: "7. Besplatna beta, promjene i prestanak",
    body: "Zatvorena beta je besplatna. Nema automatskog prelaska na plaćenu pretplatu niti naplate bez zasebnih informacija i korisnikove izričite odluke. HAJDI može izmijeniti, ograničiti ili završiti testiranje, uz razumnu prethodnu obavijest kada je izvedivo. Ako se pri završetku bete planira brisanje testnih računa i ponovno otvaranje registracije, korisnici će o tome biti obaviješteni. Korisnik može prestati koristiti betu i zatražiti brisanje računa. Zajednički sadržaj obitelji obrađuje se prema Pravilima privatnosti.",
  },
  {
    title: "8. Povratne informacije i prijava problema",
    body: "Povratne informacije o testiranju i prijave pogrešaka možete poslati na tejla@tejla.app. Nemojte u prijavama slati lozinke, pristupne ključeve ni nepotrebne osobne podatke. Prijave sigurnosnih problema obrađuju se prioritetno. Ako uputite pisani potrošački prigovor, HAJDI će potvrditi primitak i odgovoriti u zakonskom roku od 15 dana, na način propisan primjenjivim pravom.",
  },
  {
    title: "9. Odgovornost i prava korisnika",
    body: "Usluga se pruža u testnoj fazi te može sadržavati pogreške. Ništa u ovim Uvjetima ne isključuje odgovornost koja se prema prisilnim propisima ne smije isključiti niti umanjuje zakonska prava potrošača. Za pitanja o obradi podataka vrijede Pravila privatnosti. Primjenjuje se hrvatsko pravo, uz očuvanje obveznih prava korisnika prema primjenjivim propisima.",
  },
  {
    title: "10. Stupanje na snagu",
    body: "Ovi Uvjeti primjenjuju se od trenutka objave u aplikaciji. Verzija BETA 1.0. O značajnim izmjenama obavijestit ćemo testere na primjeren način.",
  },
];
