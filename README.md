# Tejla

Create a mobile-first web app called Family Hub. Purpose: Family Hub helps two parents keep all family obligations in one place. Parents receive information from emails, school apps, screenshots, PDFs, appointments and messages, and often forget to copy them into a shared calendar. For now create ONLY the visual frontend prototype. Do not add authentication, databases, payments or external integrations yet. The app language should be Croatian. Create 5 main screens accessible from a bottom navigation bar: 1. DANAS Show: - greeting "Dobro jutro" - today's family events - tasks that need to be completed - upcoming important events in the next 7 days Example events: 08:00 Lara – škola 16:30 Korina – zubar 18:00 Lucija – trening Example tasks: - Uplatiti izlet 12 € do četvrtka – assigned to Tata - Kupiti bilježnicu za Laru – assigned to Mama - Potpisati suglasnost za izlet – unassigned 2. INBOX Large central button "+ Dodaj". Below it show these options: - Fotografiraj - Screenshot / galerija - PDF dokument - Zalijepi tekst - Ručno dodaj Include explanatory text: "Pošalji nam bilo što. AI će pronaći ono što je važno za tvoju obitelj." 3. AI ANALIZA Show a sample result from an uploaded screenshot from a school system. AI found: Lara – Matematika – pisana provjera – 14. rujna Lara – Priroda – ispit – 17. rujna Lucija – Hrvatski – lektira – 18. rujna Korina – Izlet – 22. rujna – ponijeti 12 €, bocu vode i kapu Each item should have a checkbox. At the bottom add a prominent button "Dodaj sve". 4. KALENDAR Create a clean family calendar / agenda. Events should have different subtle identifiers for each family member. Show events grouped by date. 5. OBITELJ Show family members: Mama Tata Lara Lucija Korina Include a button "Pozovi roditelja". Show that Mama and Tata share the same family workspace. Design: Modern, premium, very simple and warm. Mobile-first. White or very light background. Soft purple accent. Rounded cards. Clear typography. No childish visual style. It should feel like a polished European consumer app. Keep the interface uncluttered. Important: This is only a clickable visual prototype. Do not create backend functionality yet.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://obiteljski-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b4b5ea9c-ea72-4a80-a3a4-b18658171f0b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
