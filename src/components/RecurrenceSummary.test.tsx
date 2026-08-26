import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecurrenceSummary } from "./RecurrenceSummary";

/** Recurring AI preview: repeat rule, time range, until, exception. */

const base = {
  date: "2026-09-01",
  time: "18:15",
  end_time: "20:15",
  exception_note: "",
};

describe("RecurrenceSummary", () => {
  it("shows 'Svaki utorak' for a weekly Tuesday rule", () => {
    render(
      <RecurrenceSummary
        {...base}
        recurrence={{ freq: "weekly", interval: 1, byday: ["TU"], until: "", note: "", exclude: [] }}
      />,
    );
    expect(screen.getByTestId("recurrence-summary").textContent).toContain(
      "Svaki utorak",
    );
  });

  it("shows the 18:15 – 20:15 time range", () => {
    render(
      <RecurrenceSummary
        {...base}
        recurrence={{ freq: "weekly", interval: 1, byday: ["TU"], until: "", note: "", exclude: [] }}
      />,
    );
    expect(screen.getByTestId("recurrence-summary").textContent).toContain(
      "18:15 – 20:15",
    );
  });

  it("shows the Croatian until date when the series ends", () => {
    render(
      <RecurrenceSummary
        {...base}
        recurrence={{
          freq: "weekly",
          interval: 1,
          byday: ["TU"],
          until: "2026-12-22",
          note: "",
        exclude: [],
        }}
      />,
    );
    const text = screen.getByTestId("recurrence-summary").textContent ?? "";
    expect(text).toContain("Svaki utorak");
    expect(text).toMatch(/do .*2026/);
  });

  it("shows the exception note as a separate line", () => {
    render(
      <RecurrenceSummary
        {...base}
        exception_note="osim za vrijeme školskih praznika"
        recurrence={{ freq: "weekly", interval: 1, byday: ["TU"], until: "", note: "", exclude: [] }}
      />,
    );
    expect(screen.getByTestId("recurrence-summary").textContent).toContain(
      "Iznimka: osim za vrijeme školskih praznika",
    );
  });

  it("omits the exception line when there is none", () => {
    render(
      <RecurrenceSummary
        {...base}
        recurrence={{ freq: "weekly", interval: 1, byday: ["TU"], until: "", note: "", exclude: [] }}
      />,
    );
    expect(
      screen.getByTestId("recurrence-summary").textContent,
    ).not.toContain("Iznimka");
  });
});
