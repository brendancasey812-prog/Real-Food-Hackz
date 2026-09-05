"use client";

import { Minus, Plus, Users } from "lucide-react";

/**
 * The one servings control, so setting a portion feels the same wherever you
 * do it — on a recipe, on a planned meal, or on the way to the calendar.
 *
 * The household chip is the point of it: most of the time the answer is
 * "enough for everyone", and that shouldn't need arithmetic.
 */
export function ServingsStepper({
  label = "Servings", value, onChange, min = 1, step = 1,
  hint, household, householdLabel,
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  /** A line under the control — calories, what a batch is worth. */
  hint?: React.ReactNode;
  /** One tap to make it enough for everyone. Hidden when it already is. */
  household?: number;
  householdLabel?: string;
}) {
  const showChip = household != null && household > 0 && household !== value;
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-sm text-ink-2">
          {label}
          {hint != null && <span className="ml-2 text-xs text-muted">{hint}</span>}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}
            aria-label={`Fewer ${label.toLowerCase()}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-3 hover:text-ink active:scale-95"
          >
            <Minus size={14} />
          </button>
          <input
            type="number"
            min={min}
            step={step}
            value={value}
            onChange={(e) => onChange(Math.max(min, Number(e.target.value) || min))}
            aria-label={label}
            className="field w-14 rounded-lg px-1 py-1 text-center text-sm font-semibold tabular-nums"
          />
          <button
            onClick={() => onChange(Number((value + step).toFixed(2)))}
            aria-label={`More ${label.toLowerCase()}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-3 hover:text-ink active:scale-95"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {showChip && (
        <button
          onClick={() => onChange(household)}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-wash px-2.5 py-1 text-[11px] font-medium text-accent-soft hover:bg-accent/15"
        >
          <Users size={12} />
          Enough for {householdLabel ?? `${household}`} · set {household}
        </button>
      )}
    </div>
  );
}
