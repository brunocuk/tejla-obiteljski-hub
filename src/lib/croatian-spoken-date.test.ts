import { describe, expect, it } from "vitest";
import { parseSpokenCroatianDate } from "./croatian-spoken-date";

const found = (text: string) => {
  const r = parseSpokenCroatianDate(text);
  expect(r.status).toBe("found");
  return r as { status: "found"; day: number; month: number };
};

describe("parseSpokenCroatianDate", () => {
  it.each([
    ["prvog prvog", 1, 1],
    ["drugog drugog", 2, 2],
    ["treceg desetog", 3, 10],
    ["trećeg desetog", 3, 10],
    ["desetog petog", 10, 5],
    ["petnaestog devetog", 15, 9],
    ["dvadesetog osmog", 20, 8],
    ["dvadeset prvog osmog", 21, 8],
    ["dvadeset i prvog osmog", 21, 8],
    ["dvadeset osmog osmog", 28, 8],
    ["dvadesetog osmog osmog", 20, 8],
    ["tridesetog prvog prvog", 30, 1],
    ["dvadeset i osmog osmog", 28, 8],
    ["tridesetog prvog", 30, 1],
    ["trideset prvog prvog", 31, 1],
    ["trideset i prvog prvog", 31, 1],
    ["dvanaestog dvanaestog", 12, 12],
    ["devetnaestog jedanaestog", 19, 11],
    ["prvog rujna", 1, 9],
    ["dvadeset petog kolovoza", 25, 8],
  ])("parses %s", (text, day, month) => {
    const r = found(text);
    expect([r.day, r.month]).toEqual([day, month]);
  });

  it("reads a date inside a sentence", () => {
    const r = found("imamo pregled dvadesetog osmog u 8");
    expect([r.day, r.month]).toEqual([20, 8]);
  });

  it("tolerates the spoken word mjeseca", () => {
    const r = found("petnaestog devetog mjeseca");
    expect([r.day, r.month]).toEqual([15, 9]);
  });

  it("returns none when nothing date-like was said", () => {
    expect(parseSpokenCroatianDate("kupi mlijeko i kruh").status).toBe("none");
    expect(parseSpokenCroatianDate("").status).toBe("none");
    expect(parseSpokenCroatianDate("sutra u 8").status).toBe("none");
  });

  it("returns none for an incomplete spoken date", () => {
    expect(parseSpokenCroatianDate("dvadesetog").status).toBe("none");
  });

  it("flags ambiguous phrases instead of guessing", () => {
    expect(parseSpokenCroatianDate("petog osmog devetog").status).toBe("ambiguous");
    expect(parseSpokenCroatianDate("prvog drugog i petog sestog").status).toBe("ambiguous");
    expect(parseSpokenCroatianDate("dvadeset dvadesetog").status).toBe("ambiguous");
  });

  it("rejects an impossible month", () => {
    expect(parseSpokenCroatianDate("petog petnaestog").status).toBe("ambiguous");
  });
});
