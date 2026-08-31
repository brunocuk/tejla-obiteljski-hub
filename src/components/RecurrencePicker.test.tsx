import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecurrencePicker } from "./RecurrencePicker";
import { NO_RECURRENCE, type EventRecurrence } from "@/lib/recurrence";

const weekly: EventRecurrence = {
  ...NO_RECURRENCE,
  freq: "weekly",
  byday: ["TU"],
};

describe("RecurrencePicker calendar exceptions", () => {
  it("offers both Croatian calendar toggles for a repeating event", () => {
    render(<RecurrencePicker value={weekly} startDate="2026-09-01" onChange={vi.fn()} />);
    expect(screen.getByLabelText("Preskoči školske odmore")).toBeTruthy();
    expect(screen.getByLabelText("Preskoči blagdane")).toBeTruthy();
  });

  it("adds school_breaks_hr when the school toggle is checked", async () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value={weekly} startDate="2026-09-01" onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Preskoči školske odmore"));
    expect(onChange.mock.calls[0]?.[0].exclude).toEqual(["school_breaks_hr"]);
  });

  it("removes a rule when its toggle is unchecked", async () => {
    const onChange = vi.fn();
    render(
      <RecurrencePicker
        value={{ ...weekly, exclude: ["school_breaks_hr", "public_holidays_hr"] }}
        startDate="2026-09-01"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByLabelText("Preskoči blagdane"));
    expect(onChange.mock.calls[0]?.[0].exclude).toEqual(["school_breaks_hr"]);
  });

  it("hides the toggles when the event does not repeat", () => {
    render(<RecurrencePicker value={NO_RECURRENCE} startDate="2026-09-01" onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Preskoči školske odmore")).toBeNull();
  });
});

describe("RecurrencePicker daily repeats and end conditions", () => {
  it("offers the Croatian frequency labels including a true daily repeat", () => {
    render(<RecurrencePicker value={NO_RECURRENCE} startDate="2026-09-01" onChange={vi.fn()} />);
    for (const label of ["Ne ponavlja se", "Svaki dan", "Tjedno", "Mjesečno"]) {
      expect(screen.getByRole("option", { name: label })).toBeTruthy();
    }
  });

  it("switches to a daily rule without weekday chips", async () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value={NO_RECURRENCE} startDate="2026-09-01" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /Ponavljanje/ }), "daily");
    expect(onChange.mock.calls[0]?.[0]).toMatchObject({ freq: "daily", byday: [] });
  });

  it("shows the Croatian weekday chips and blocks auto-translation", () => {
    render(<RecurrencePicker value={weekly} startDate="2026-09-01" onChange={vi.fn()} />);
    for (const day of ["pon", "uto", "sri", "čet", "pet", "sub", "ned"]) {
      const chip = screen.getByRole("button", { name: day });
      expect(chip.getAttribute("translate")).toBe("no");
    }
  });

  it("supports 'Bez završetka' and 'Na datum'", async () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value={weekly} startDate="2026-09-01" onChange={onChange} />);
    const end = screen.getByLabelText("Završetak ponavljanja");
    await userEvent.selectOptions(end, "on_date");
    expect(onChange.mock.calls[0]?.[0].until).toBe("2026-09-01");

    onChange.mockClear();
    render(
      <RecurrencePicker
        value={{ ...weekly, until: "2026-12-31" }}
        startDate="2026-09-01"
        onChange={onChange}
      />,
    );
    expect(screen.getAllByLabelText("Datum završetka")[0]).toBeTruthy();
  });
});
