import {
  NO_RECURRENCE,
  WEEKDAY_CODES,
  WEEKDAY_SHORT,
  describeRecurrence,
  weekdayCodeOf,
  type EventRecurrence,
  type RecurrenceFreq,
  type WeekdayCode,
} from "@/lib/recurrence";
import {
  EXCLUDE_TOGGLE_LABELS,
  sanitizeExcludeCodes,
  type RecurrenceExcludeCode,
} from "@/lib/recurrence-exclude";

const fieldClass =
  "mt-1 w-full rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none focus:border-primary";

const FREQ_LABELS: { value: RecurrenceFreq | "none"; label: string }[] = [
  { value: "none", label: "Ne ponavlja se" },
  { value: "daily", label: "Svaki dan" },
  { value: "weekly", label: "Tjedno" },
  { value: "monthly", label: "Mjesečno" },
];


/**
 * Repeat rule editor. V1 is built around weekly repeats ("svaki utorak"), but
 * the shape is already the daily/monthly one so nothing has to change later.
 */
export function RecurrencePicker({
  value,
  startDate,
  onChange,
  disabled = false,
}: {
  value: EventRecurrence;
  startDate: string;
  onChange: (next: EventRecurrence) => void;
  disabled?: boolean;
}) {
  const startCode = weekdayCodeOf(startDate);
  const days: WeekdayCode[] =
    value.byday.length > 0 ? value.byday : startCode ? [startCode] : [];

  const setFreq = (raw: string) => {
    if (raw === "none") {
      onChange(NO_RECURRENCE);
      return;
    }
    const freq = raw as RecurrenceFreq;
    onChange({
      ...value,
      freq,
      byday: freq === "weekly" ? days : [],
    });
  };

  const exclude = sanitizeExcludeCodes(value.exclude);
  const toggleExclude = (code: RecurrenceExcludeCode) => {
    const next = exclude.includes(code)
      ? exclude.filter((c) => c !== code)
      : [...exclude, code];
    onChange({ ...value, exclude: sanitizeExcludeCodes(next) });
  };

  const toggleDay = (code: WeekdayCode) => {
    const next = days.includes(code) ? days.filter((d) => d !== code) : [...days, code];
    onChange({ ...value, byday: next });
  };

  if (disabled) return null;

  return (
    <div className="rounded-2xl bg-secondary p-4">
      <label className="block text-sm font-semibold">
        Ponavljanje
        <select
          value={value.freq ?? "none"}
          onChange={(e) => setFreq(e.target.value)}
          className={fieldClass}
        >
          {FREQ_LABELS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {value.freq ? (
        <div className="mt-3 space-y-3">
          {value.freq === "weekly" ? (
            <div>
              <p className="text-sm font-semibold">Kojim danima?</p>
              {/* translate="no": browser auto-translation turns "uto"/"sri"/"pet" into
                  unrelated words ("auto", "gospodin", "ljubimac"). */}
              <div className="mt-2 flex flex-wrap gap-2" translate="no" lang="hr">
                {WEEKDAY_CODES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    translate="no"
                    aria-pressed={days.includes(code)}
                    onClick={() => toggleDay(code)}
                    className={`notranslate rounded-full px-3.5 py-2 text-sm font-semibold ${
                      days.includes(code)
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground"
                    }`}
                  >
                    {WEEKDAY_SHORT[code]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Svaki
              <select
                value={String(value.interval)}
                onChange={(e) => onChange({ ...value, interval: Number(e.target.value) })}
                className={fieldClass}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "1." : `${n}.`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Završetak
              <select
                aria-label="Završetak ponavljanja"
                value={value.until ? "on_date" : "never"}
                onChange={(e) =>
                  onChange({
                    ...value,
                    until: e.target.value === "never"
                      ? ""
                      : value.until || startDate || new Date().toISOString().slice(0, 10),
                  })
                }
                className={fieldClass}
              >
                <option value="never">Bez završetka</option>
                <option value="on_date">Na datum</option>
              </select>
            </label>
          </div>

          {value.until ? (
            <label className="block text-sm font-semibold">
              Ponavljaj do (uključivo)
              <input
                type="date"
                aria-label="Datum završetka"
                value={value.until}
                onChange={(e) => onChange({ ...value, until: e.target.value })}
                className={fieldClass}
              />
            </label>
          ) : null}


          <div>
            <p className="text-sm font-semibold">Hrvatski kalendar</p>
            <div className="mt-2 space-y-2">
              {(["school_breaks_hr", "public_holidays_hr"] as RecurrenceExcludeCode[]).map((code) => (
                <label
                  key={code}
                  className="flex items-center gap-3 rounded-2xl bg-background px-4 py-3 text-sm font-semibold"
                >
                  <input
                    type="checkbox"
                    checked={exclude.includes(code)}
                    onChange={() => toggleExclude(code)}
                    className="size-4 accent-[hsl(var(--primary))]"
                  />
                  {EXCLUDE_TOGGLE_LABELS[code]}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Termini na te dane automatski se preskaču.
            </p>
          </div>

          <label className="block text-sm font-semibold">
            Ostale iznimke <span className="font-normal text-muted-foreground">(neobavezno)</span>
            <input
              value={value.note}
              onChange={(e) => onChange({ ...value, note: e.target.value })}
              placeholder="npr. osim školskih praznika"
              className={fieldClass}
            />
          </label>
          <p className="text-xs font-medium text-muted-foreground">
            {describeRecurrence(value, startDate)}
            {value.note ? " · iznimke ne uklanjamo automatski, termin preskoči ručno." : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
