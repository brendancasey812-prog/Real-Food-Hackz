"use client";

import { useEffect } from "react";
import { Minus, Plus, X } from "lucide-react";
import { fmtQty, pluralUnit, stepFor, unitLabel } from "@/lib/units";
import { FOOD_CATEGORY_LABEL } from "@/lib/foodcat";
import type { Food } from "@/lib/types";

const LOCATION_LABEL: Record<Food["location"], string> = {
  fridge: "Fridge",
  freezer: "Freezer",
  pantry: "Pantry",
};

/**
 * Tapping a food opens this sheet — the one place to change how much you have,
 * with its nutrition alongside so the number means something.
 */
export function FoodSheet({
  food: f, quantity, onQuantity, onClose,
}: {
  food: Food;
  quantity: number;
  onQuantity: (q: number) => void;
  onClose: () => void;
}) {
  const step = stepFor(f.unit);
  const set = (q: number) => onQuantity(Math.max(0, Number(q.toFixed(2))));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const macros = [
    { label: "Protein", value: f.protein, text: "text-protein-soft", bg: "bg-protein/12" },
    { label: "Carbs", value: f.carbs, text: "text-carbs-soft", bg: "bg-carbs/12" },
    { label: "Fat", value: f.fat, text: "text-fat-soft", bg: "bg-fat/12" },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-up max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-page p-5 pb-8 md:rounded-3xl md:pb-5"
      >
        <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-line-2 md:hidden" />

        <div className="flex items-start gap-4">
          <span className="squircle flex h-16 w-16 shrink-0 items-center justify-center bg-gradient-to-br from-accent/25 to-accent/10 text-[30px] ring-1 ring-accent/20">
            {f.emoji}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <h2 className="truncate text-lg font-semibold text-ink">{f.name}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {FOOD_CATEGORY_LABEL[f.category]} · {LOCATION_LABEL[f.location]}
              {f.notes ? ` · ${f.notes}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>

        {/* How much you have */}
        <div className="mt-5 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">On hand</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <button
              onClick={() => set(quantity - step)}
              aria-label="Less"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-surface-3 active:scale-95"
            >
              <Minus size={18} />
            </button>
            <div className="text-center">
              <input
                type="number"
                min={0}
                step={step}
                value={quantity}
                onChange={(e) => set(Number(e.target.value) || 0)}
                aria-label={`${f.name} quantity`}
                className="w-24 rounded-xl field px-2 py-1.5 text-center text-2xl font-semibold tabular-nums"
              />
              <p className="mt-1 text-xs text-muted">{pluralUnit(quantity, f.unit)}</p>
            </div>
            <button
              onClick={() => set(quantity + step)}
              aria-label="More"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-surface-3 active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(12, Math.ceil(quantity * 1.5), step)}
            step={step}
            value={quantity}
            onChange={(e) => set(Number(e.target.value))}
            aria-label={`${f.name} slider`}
            className="mt-4 h-1.5 w-full cursor-pointer accent-accent"
          />
        </div>

        {/* What it's worth */}
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Per {unitLabel(f.unit)}
            </p>
            <p className="text-sm text-muted">
              <span className="font-semibold text-cal-soft tabular-nums">
                {Math.round(quantity * f.caloriesPerUnit).toLocaleString()}
              </span>{" "}
              cal on hand
            </p>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-cal/12 py-2">
              <div className="text-sm font-semibold tabular-nums text-cal-soft">{f.caloriesPerUnit}</div>
              <div className="text-[10px] text-muted">cal</div>
            </div>
            {macros.map((m) => (
              <div key={m.label} className={`rounded-xl py-2 ${m.bg}`}>
                <div className={`text-sm font-semibold tabular-nums ${m.text}`}>{m.value}g</div>
                <div className="text-[10px] text-muted">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="btn-accent mt-4 w-full rounded-xl py-3 text-sm">
          Done
        </button>
        <p className="mt-2 text-center text-[11px] text-muted">
          {fmtQty(quantity)} {pluralUnit(quantity, f.unit)} · updates the grocery list and planner instantly
        </p>
      </div>
    </div>
  );
}
