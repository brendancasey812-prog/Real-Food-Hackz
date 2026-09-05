"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { X, ChevronRight, Eraser } from "lucide-react";
import { weekDays, isoOf } from "@/lib/week";
import type { PlannedMeal } from "@/lib/types";

/** ISO dates sort as strings, so a range test needs no date parsing. */
const inRange = (iso: string, from: string, to: string) => iso >= from && iso <= to;

/**
 * Everything for wiping planned meals in one place: the obvious scopes, a
 * pick-the-days-you-mean grid for the visible week, and an arbitrary range.
 * It only ever hands dates back — the caller confirms and does the deleting.
 */
export function ClearMealsSheet({
  anchor, plan, onChoose, onClose
}: {
  anchor: Date;
  plan: PlannedMeal[];
  /** Dates to clear, plus wording for the confirmation step. */
  onChoose: (dates: string[], scope: string, count: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const week = useMemo(() => weekDays(anchor), [anchor]);
  const weekIsos = week.map(isoOf);
  const anchorIso = isoOf(anchor);
  const monthPrefix = format(anchor, "yyyy-MM");
  const yearPrefix = format(anchor, "yyyy");

  // Only dates that actually carry meals need clearing.
  const datesWhere = (test: (iso: string) => boolean) =>
    Array.from(new Set(plan.map((m) => m.date).filter(test)));
  const countOf = (dates: string[]) => {
    const set = new Set(dates);
    return plan.filter((m) => set.has(m.date)).length;
  };

  const perDay = useMemo(() => {
    const tally = new Map<string, number>();
    for (const m of plan) tally.set(m.date, (tally.get(m.date) ?? 0) + 1);
    return tally;
  }, [plan]);

  const quick = [
    {
      key: "day",
      label: format(anchor, "EEEE, MMM d"),
      hint: "This day",
      dates: [anchorIso],
      scope: format(anchor, "EEEE, MMMM d")
    },
    {
      key: "week",
      label: `Week of ${format(week[0], "MMM d")}`,
      hint: "This week",
      dates: weekIsos,
      scope: `the week of ${format(week[0], "MMMM d")}`
    },
    {
      key: "month",
      label: format(anchor, "MMMM yyyy"),
      hint: "This month",
      dates: datesWhere((d) => d.startsWith(monthPrefix)),
      scope: format(anchor, "MMMM yyyy")
    },
    {
      key: "year",
      label: format(anchor, "yyyy"),
      hint: "This year",
      dates: datesWhere((d) => d.startsWith(yearPrefix)),
      scope: `${format(anchor, "yyyy")}`
    },
  ];

  // --- pick specific days of the visible week ---
  const [days, setDays] = useState<string[]>([]);
  const toggleDay = (iso: string) =>
    setDays((d) => (d.includes(iso) ? d.filter((x) => x !== iso) : [...d, iso]));
  const daysCount = countOf(days);

  // --- arbitrary range ---
  const [from, setFrom] = useState(weekIsos[0]);
  const [to, setTo] = useState(weekIsos[6]);
  const rangeDates = datesWhere((d) => inRange(d, from, to));
  const rangeCount = countOf(rangeDates);
  const rangeValid = from <= to;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-up flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl border border-line bg-page md:rounded-3xl"
      >
        <div className="shrink-0 px-5 pt-4">
          <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line-2 md:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">Clear meals</h2>
              <p className="text-xs text-muted">Calendar events are never touched.</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <Label>Quick</Label>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {quick.map((row, i) => {
              const count = countOf(row.dates);
              return (
                <button
                  key={row.key}
                  disabled={count === 0}
                  onClick={() => onChoose(row.dates, row.scope, count)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                    i > 0 ? "border-t border-line" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${count ? "text-ink" : "text-muted"}`}>
                      {row.label}
                    </span>
                    <span className="block text-[11px] text-muted">{row.hint}</span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {count === 0 ? "none" : `${count} ${count === 1 ? "meal" : "meals"}`}
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-muted" />
                </button>
              );
            })}
          </div>

          {/* Specific days of the week on screen */}
          <Label>Pick days · week of {format(week[0], "MMM d")}</Label>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {week.map((d) => {
              const iso = isoOf(d);
              const n = perDay.get(iso) ?? 0;
              const on = days.includes(iso);
              return (
                <button
                  key={iso}
                  onClick={() => toggleDay(iso)}
                  disabled={n === 0}
                  aria-pressed={on}
                  className={`rounded-xl border px-1 py-2 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    on ? "border-accent bg-accent-wash text-accent-soft" : "border-line bg-surface text-ink-2 hover:bg-surface-3"
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-wide text-muted">
                    {format(d, "EEE")}
                  </span>
                  <span className="block text-sm font-semibold tabular-nums">{format(d, "d")}</span>
                  <span className="block text-[10px] tabular-nums text-muted">{n || "—"}</span>
                </button>
              );
            })}
          </div>
          <button
            disabled={daysCount === 0}
            onClick={() =>
              onChoose(
                days,
                days.length === 1
                  ? format(new Date(`${days[0]}T00:00:00`), "EEEE, MMMM d")
                  : `${days.length} selected days`,
                daysCount,
              )
            }
            className="mt-2 w-full rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-danger/10 hover:text-danger-soft disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-surface"
          >
            {daysCount === 0
              ? "Select a day above"
              : `Clear ${daysCount} ${daysCount === 1 ? "meal" : "meals"} on ${days.length} ${days.length === 1 ? "day" : "days"}`}
          </button>

          {/* Any range at all */}
          <Label>Date range</Label>
          <div className="flex items-center gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[11px] text-muted">From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="field w-full rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[11px] text-muted">To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="field w-full rounded-xl px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            disabled={!rangeValid || rangeCount === 0}
            onClick={() =>
              onChoose(
                rangeDates,
                `${format(new Date(`${from}T00:00:00`), "MMM d")} – ${format(new Date(`${to}T00:00:00`), "MMM d, yyyy")}`,
                rangeCount,
              )
            }
            className="mt-2 w-full rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-ink-2 transition-colors hover:bg-danger/10 hover:text-danger-soft disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-surface"
          >
            {!rangeValid
              ? "The end date is before the start"
              : rangeCount === 0
              ? "No meals in that range"
              : `Clear ${rangeCount} ${rangeCount === 1 ? "meal" : "meals"} in range`}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3 text-[11px] text-muted">
          <Eraser size={13} className="shrink-0" />
          Every option asks you to confirm first.
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted first:mt-0">
      {children}
    </p>
  );
}
