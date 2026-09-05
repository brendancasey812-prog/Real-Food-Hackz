"use client";

import { useMemo, useState } from "react";
import { X, Check, BookMarked } from "lucide-react";
import { useApp } from "@/lib/store";
import { unitLabel } from "@/lib/units";
import { usdaFor, canApplyUsda, missingNutrition, USDA_COUNT, SOURCE_LABEL } from "@/lib/usda";
import type { Food } from "@/lib/types";

interface Row {
  food: Food;
  description: string;
  fdcId: number;
  score: number;
  nutrition: { caloriesPerUnit: number; protein: number; carbs: number; fat: number };
  /** The food already has numbers — replacing them is opt-in. */
  hasNumbers: boolean;
}

/**
 * Fill in nutrition from the USDA reference.
 *
 * Foods with nothing on them are proposed by default. Foods that already carry
 * numbers are shown only on request and start unticked, because the value they
 * have may well be the more accurate one — and anything the user scanned or
 * typed is excluded outright.
 */
export function UsdaFillModal({ onClose }: { onClose: () => void }) {
  const { foods, updateFood } = useApp();
  const [showExisting, setShowExisting] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [done, setDone] = useState<number | null>(null);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const food of foods) {
      if (!canApplyUsda(food)) continue;
      const ref = usdaFor(food);
      if (!ref) continue;
      const hasNumbers = !missingNutrition(food);
      // Nothing to do when the food already agrees with the reference.
      if (hasNumbers && food.caloriesPerUnit === ref.nutrition.caloriesPerUnit) continue;
      out.push({
        food,
        description: ref.match.entry.n,
        fdcId: ref.match.entry.id,
        score: ref.match.score,
        nutrition: ref.nutrition,
        hasNumbers,
      });
    }
    return out.sort((a, b) => Number(a.hasNumbers) - Number(b.hasNumbers) || a.food.name.localeCompare(b.food.name));
  }, [foods]);

  const blank = rows.filter((r) => !r.hasNumbers);
  const existing = rows.filter((r) => r.hasNumbers);
  const visible = showExisting ? rows : blank;

  const isOn = (r: Row) =>
    r.hasNumbers ? extra.includes(r.food.id) : !skipped.includes(r.food.id);
  const toggle = (r: Row) => {
    if (r.hasNumbers) {
      setExtra((x) => (x.includes(r.food.id) ? x.filter((i) => i !== r.food.id) : [...x, r.food.id]));
    } else {
      setSkipped((x) => (x.includes(r.food.id) ? x.filter((i) => i !== r.food.id) : [...x, r.food.id]));
    }
  };

  // Only what is on screen can be ticked, so the count is over that.
  const chosen = visible.filter(isOn);

  const apply = () => {
    for (const r of chosen) {
      updateFood(r.food.id, {
        ...r.nutrition,
        nutritionSource: "usda",
        fdcId: r.fdcId,
      });
    }
    setDone(chosen.length);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-page md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <BookMarked size={18} className="text-accent-soft" /> Fill macros from USDA
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {done != null ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent-soft">
                <Check size={28} />
              </span>
              <p className="font-semibold text-ink">
                {done} {done === 1 ? "food" : "foods"} updated
              </p>
              <p className="max-w-sm text-sm text-muted">
                Recipes, the meal plan and the dashboard all recalculate from the new numbers.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted">
                {USDA_COUNT} foods from USDA FoodData Central back this app as its nutrition
                reference. Anything you scanned from a label or typed in yourself is left alone.
              </p>

              {blank.length === 0 && !showExisting && (
                <p className="mt-5 rounded-xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
                  {existing.length === 0
                    ? "Every food already matches the reference. Nothing to fill in."
                    : `No food is missing its nutrition. ${existing.length} ${existing.length === 1 ? "food has numbers that differ" : "foods have numbers that differ"} from the reference — turn on the option below to review them.`}
                </p>
              )}

              {visible.length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {visible.map((r) => {
                    const on = isOn(r);
                    return (
                      <button
                        key={r.food.id}
                        onClick={() => toggle(r)}
                        aria-pressed={on}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          on ? "border-accent bg-accent-wash" : "border-line bg-surface hover:bg-surface-3"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            on ? "border-accent bg-accent text-on-accent" : "border-line-2 text-transparent"
                          }`}
                        >
                          <Check size={12} strokeWidth={3} />
                        </span>
                        <span className="shrink-0 text-lg">{r.food.emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{r.food.name}</span>
                          <span className="block truncate text-[11px] text-muted">{r.description}</span>
                        </span>
                        <span className="shrink-0 text-right text-[11px] tabular-nums">
                          <span className="block font-semibold text-cal-soft">
                            {r.nutrition.caloriesPerUnit} cal / {unitLabel(r.food.unit)}
                          </span>
                          <span className="block text-muted">
                            {r.hasNumbers ? `was ${r.food.caloriesPerUnit}` : "was blank"} ·{" "}
                            {r.nutrition.protein}p {r.nutrition.carbs}c {r.nutrition.fat}f
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {existing.length > 0 && (
                <label className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={showExisting}
                    onChange={(e) => setShowExisting(e.target.checked)}
                    className="mt-0.5 accent-accent"
                  />
                  <span>
                    <span className="block text-ink-2">
                      Also review {existing.length} {existing.length === 1 ? "food that" : "foods that"} already
                      {existing.length === 1 ? " has" : " have"} numbers
                    </span>
                    <span className="block text-[11px] leading-4 text-muted">
                      Those figures may already be the more accurate ones, so they start unticked —
                      turn on only the ones you want the reference to replace.
                    </span>
                  </span>
                </label>
              )}

              <p className="mt-4 text-[11px] leading-4 text-muted">
                Applied values are marked “{SOURCE_LABEL.usda}” on the food, with the FDC record id,
                and will not be overwritten by a later fill.
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line px-5 py-4">
          {done != null ? (
            <button onClick={onClose} className="btn-accent ml-auto rounded-xl px-5 py-2.5 text-sm">Done</button>
          ) : (
            <>
              <span className="text-xs text-muted">
                {chosen.length} of {visible.length} selected
              </span>
              <button
                onClick={apply}
                disabled={chosen.length === 0}
                className="btn-accent flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check size={16} /> Fill {chosen.length} {chosen.length === 1 ? "food" : "foods"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
