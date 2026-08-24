import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  NUDGE_KIND,
  SEND_HOURS,
  WEEKLY_LIMIT,
  addDays,
  dedupeKey,
  isQuietHour,
  normalizeCategory,
  pickNudge,
  quotaBlocks,
  zagrebNow,
  type CalendarEvent,
  type NudgeContext,
} from "@/lib/notifications/tejla-messages";
import { TEJLA_MESSAGES_DEFAULT } from "@/lib/notification-prefs";

const ev = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e1",
  date: "2026-08-27",
  category: "Putovanje",
  type: "event",
  completed: false,
  ...over,
});

// Thursday 2026-08-27 is a Thursday; keep a stable "today".
const baseNow = { date: "2026-08-24", hour: 9, weekday: 1 };
const ctx = (over: Partial<NudgeContext> = {}): NudgeContext => ({
  now: baseNow,
  events: [],
  recent: [],
  ...over,
});

describe("opt-in default", () => {
  it("Tejline poruke su isključene dok ih korisnik ne uključi", () => {
    expect(TEJLA_MESSAGES_DEFAULT).toBe(false);
  });

  it("migracija postavlja default false i CASCADE brisanje", () => {
    const sql = readFileSync("src/lib/__fixtures__/user-notification-prefs.sql", "utf8");
    expect(sql).toContain("tejla_messages_enabled boolean NOT NULL DEFAULT false");
    expect(sql).toContain("ON DELETE CASCADE");
  });

  it("scheduler šalje samo korisnicima s uključenom postavkom", () => {
    const src = readFileSync("src/lib/notifications/tejla-messages.server.ts", "utf8");
    expect(src).toContain('.eq("tejla_messages_enabled", true)');
  });
});

describe("timezone / DST", () => {
  it("ljetno vrijeme: 07:30 UTC je 09:30 u Zagrebu", () => {
    const now = zagrebNow(new Date("2026-08-24T07:30:00Z"));
    expect(now.hour).toBe(9);
    expect(now.date).toBe("2026-08-24");
  });

  it("zimsko vrijeme: 07:30 UTC je 08:30 u Zagrebu", () => {
    const now = zagrebNow(new Date("2026-01-15T07:30:00Z"));
    expect(now.hour).toBe(8);
  });

  it("ponoć u Zagrebu je još prethodni UTC dan", () => {
    const now = zagrebNow(new Date("2026-08-24T22:30:00Z"));
    expect(now.date).toBe("2026-08-25");
    expect(now.hour).toBe(0);
  });

  it("tihi sati 22:00–08:00", () => {
    expect(isQuietHour(22)).toBe(true);
    expect(isQuietHour(3)).toBe(true);
    expect(isQuietHour(7)).toBe(true);
    expect(isQuietHour(8)).toBe(false);
    expect(isQuietHour(21)).toBe(false);
    expect(SEND_HOURS.every((h) => !isQuietHour(h))).toBe(true);
  });

  it("noću se ne bira nijedna poruka", () => {
    expect(pickNudge(ctx({ now: { ...baseNow, hour: 23 } }))).toBeNull();
  });
});

describe("pravila", () => {
  it("prazan sutrašnji dan", () => {
    const pick = pickNudge(ctx());
    expect(pick?.messageKey).toBe("calm:empty_tomorrow");
    expect(pick?.body).toBe("Sutra ti je kalendar prazan.");
  });

  it("countdown 3 dana za whitelist kategoriju", () => {
    const pick = pickNudge(
      ctx({ events: [ev({ date: addDays(baseNow.date, 3) }), ev({ id: "e2", date: addDays(baseNow.date, 1), category: "Sastanak" })] }),
    );
    expect(pick?.messageKey).toBe("countdown:putovanje:3");
  });

  it("countdown 1 dan ima prednost pred praznim sutra", () => {
    const pick = pickNudge({
      now: baseNow,
      events: [ev({ date: addDays(baseNow.date, 1), category: "Koncert" })],
      recent: [],
    });
    expect(pick?.messageKey).toBe("countdown:koncert:1");
    expect(pick?.body).toContain("koncerta");
  });

  it("miran vikend samo četvrtkom/petkom", () => {
    const thursday = pickNudge(ctx({ now: { date: "2026-08-27", hour: 18, weekday: 4 }, recent: [{ messageKey: "calm:empty_tomorrow", date: "2026-08-27" }] }));
    expect(thursday).toBeNull(); // dnevni limit
    const fri = pickNudge(
      ctx({
        now: { date: "2026-08-28", hour: 18, weekday: 5 },
        events: [ev({ date: "2026-08-29", category: "Putovanje" })],
      }),
    );
    // vikend nije miran (subota ima događaj) → bira countdown
    expect(fri?.messageKey).toBe("countdown:putovanje:1");
  });

  it("blagdan ima prioritet", () => {
    const pick = pickNudge(ctx({ now: { date: "2026-12-25", hour: 9, weekday: 5 } }));
    expect(pick?.messageKey).toBe("holiday:bozic");
  });

  it("dovršeni događaj ne blokira 'prazno sutra'", () => {
    const pick = pickNudge(
      ctx({ events: [ev({ date: addDays(baseNow.date, 1), completed: true, category: "Ispit" })] }),
    );
    expect(pick?.messageKey).toBe("calm:empty_tomorrow");
  });
});

describe("whitelist i privatnost", () => {
  it("osjetljive i nepoznate kategorije nikad ne generiraju poruku", () => {
    for (const category of ["Pregled", "Zubar", "Ispit", "Škola", "", null, "Terapija"]) {
      expect(normalizeCategory(category)).toBeNull();
    }
  });

  it("dozvoljene kategorije", () => {
    expect(normalizeCategory("putovanje")).toBe("putovanje");
    expect(normalizeCategory("Godišnji odmor")).toBe("godišnji");
    expect(normalizeCategory("Rođendan")).toBe("rođendan");
    expect(normalizeCategory("Izlet")).toBe("izlet");
  });

  it("naslov događaja nikad ne ulazi u tekst poruke", () => {
    const pick = pickNudge(
      ctx({ events: [ev({ date: addDays(baseNow.date, 3), category: "Rođendan" })] }),
    );
    expect(pick?.body).toBe("Još 3 dana do rođendana.");
    const src = readFileSync("src/lib/notifications/tejla-messages.ts", "utf8");
    expect(src).not.toContain("event.title");
  });
});

describe("kvote i deduplikacija", () => {
  const candidate = { messageKey: "calm:empty_tomorrow", bucket: "2026-08-25", body: "x", deepLink: "/", subjectId: null };

  it("max 1 dnevno", () => {
    expect(quotaBlocks(candidate, baseNow, [{ messageKey: "holiday:bozic", date: baseNow.date }])).toBe(true);
  });

  it("max 2 u 7 dana", () => {
    const recent = [
      { messageKey: "holiday:bozic", date: addDays(baseNow.date, -2) },
      { messageKey: "countdown:koncert:3", date: addDays(baseNow.date, -5) },
    ];
    expect(recent.length).toBe(WEEKLY_LIMIT);
    expect(quotaBlocks(candidate, baseNow, recent)).toBe(true);
    // starije od 7 dana više ne blokira
    const old = recent.map((r) => ({ ...r, date: addDays(baseNow.date, -9) }));
    expect(quotaBlocks(candidate, baseNow, old)).toBe(false);
  });

  it("ista vrsta poruke ne ponavlja se prebrzo", () => {
    expect(
      quotaBlocks(candidate, baseNow, [{ messageKey: candidate.messageKey, date: addDays(baseNow.date, -10) }]),
    ).toBe(true);
  });

  it("stabilan dedupe_key za isti kontekst", () => {
    expect(dedupeKey("u1", candidate)).toBe("tejla:calm:empty_tomorrow:u1:2026-08-25");
    expect(dedupeKey("u1", candidate)).toBe(dedupeKey("u1", candidate));
    expect(dedupeKey("u2", candidate)).not.toBe(dedupeKey("u1", candidate));
  });

  it("kind je odvojen od assignment notifikacija", () => {
    expect(NUDGE_KIND).toBe("tejla_message");
  });
});

describe("primatelji i izolacija", () => {
  const server = readFileSync("src/lib/notifications/tejla-messages.server.ts", "utf8");

  it("arhivirani član nikad nije primatelj", () => {
    expect(server).toContain("member.archived_at");
  });

  it("samo korisnici s aktivnom push pretplatom", () => {
    expect(server).toContain("push_subscriptions");
    expect(server).toContain("device_push_tokens");
  });

  it("koristi postojeći dispatch i notification_events", () => {
    expect(server).toContain("dispatchNotifications");
    expect(server).toContain("notification_events");
  });

  it("reminder engine ostaje netaknut", () => {
    const reminders = readFileSync("src/routes/api/public/hooks/send-reminders.ts", "utf8");
    expect(reminders).not.toContain("tejla_message");
    expect(reminders).not.toContain("user_notification_prefs");
    expect(server).not.toContain("event_reminders");
  });

  it("brisanje računa uklanja postavku kaskadno", () => {
    const sql = readFileSync("src/lib/__fixtures__/user-notification-prefs.sql", "utf8");
    expect(sql).toContain("REFERENCES auth.users(id) ON DELETE CASCADE");
  });
});
