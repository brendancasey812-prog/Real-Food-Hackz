"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { X, Check, Minus, Plus, CalendarDays } from "lucide-react";
import { useApp, newId, recipeCaloriesPerServing } from "@/lib/store";
import { weekDays, isoOf, MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import { MEAL_COLOR } from "@/lib/mealtime";
import type { MealType, Recipe } from "@/lib/types";

/**
 * Schedule a recipe straight from the Cookbook.
 *
 * The Meal Plan already lets you pick a recipe onto a slot; this is the other
 * direction — you are looking at something you want to eat and need a day for
 * it, without going to the calendar and hunting the recipe down again.
 */
export function AddToPlanSheet({
  recipe, onClose,
}: {
  recipe: Recipe;
  onClose: () => void;
}) {
  const { foods, recipes, plan, addPlannedMeal, householdMode, members } = useApp();

  // Couple/family: one recipe should feed everyone, so default the servings.
  const householdSize = householdMode === "individual" ? 1 : 1 + (members?.length ?? 0);

  const [weekOffset, setWeekOffset] = useState(0);
  const [date, setDate] = useState(isoOf(new Date()));
  const [meal, setMeal] = useState<MealType>(recipe.category);
  const [servings, setServings] = useState(Math.max(1, householdSize));
  const [added, setAdded] = useState<string | null>(null);

  const days = weekDays(addDays(new Date(), weekOffset * 7));
  const perServing = recipeCaloriesPerServing(recipe, foods, recipes);
  const alreadyThere = plan.some(
    (m) => m.date === date && m.mealType === meal && m.recipeId === recipe.id,
  );

  const save = () => {
    addPlannedMeal({
      id: newId(),
      date,
      mealType: meal,
      recipeId: recipe.id,
      servings: Math.max(1, servings),
    });
    setAdded(`${MEAL_LABEL[meal]} on ${format(new Date(`${date}T00:00:00`), "EEEE, MMM d")}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-up flex max-h-[92vh] w-full max-w-md flex-col rounded-t-3xl border border-line bg-page md:rounded-3xl"
      >
        <div className="shrink-0 px-5 pt-4">
          <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line-2 md:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="squircle flex h-11 w-11 shrink-0 items-center justify-center bg-gradient-to-br from-accent/25 to-accent/10 text-xl ring-1 ring-accent/20">
                {recipe.emoji}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-ink">{recipe.name}</h2>
                <p className="text-xs text-muted">{perServing.toLocaleString()} cal / serving</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted hover:text-ink">
              <X size={20} />
            </button>
          </div>
        </div>

        {added ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-wash text-accent-soft">
              <Check size={28} />
            </span>
            <p className="font-semibold text-ink">Added to your Meal Plan</p>
            <p className="text-sm text-muted">{added}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => setAdded(null)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3">
                Add another day
              </button>
              <button onClick={onClose} className="btn-accent rounded-xl px-5 py-2.5 text-sm">Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {/* Which day */}
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Day</p>
                <div className="flex items-center gap-1 text-xs">
                  <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded-lg px-2 py-1 text-muted hover:bg-surface-3 hover:text-ink">←</button>
                  <span className="text-muted">Week of {format(days[0], "MMM d")}</span>
                  <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded-lg px-2 py-1 text-muted hover:bg-surface-3 hover:text-ink">→</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((d) => {
                  const iso = isoOf(d);
                  const on = iso === date;
                  return (
                    <button
                      key={iso}
                      onClick={() => setDate(iso)}
                      aria-pressed={on}
                      className={`rounded-xl border px-1 py-2 text-center transition-colors ${
                        on ? "border-accent bg-accent-wash text-accent-soft" : "border-line bg-surface text-ink-2 hover:bg-surface-3"
                      }`}
                    >
                      <span className="block text-[10px] uppercase tracking-wide text-muted">{format(d, "EEE")}</span>
                      <span className="block text-sm font-semibold tabular-nums">{format(d, "d")}</span>
                    </button>
                  );
                })}
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                aria-label="Pick any date"
                className="field mt-2 w-full rounded-xl px-3 py-2 text-sm"
              />

              {/* Which slot */}
              <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted">Meal</p>
              <div className="flex flex-wrap gap-1.5">
                {MEAL_ORDER.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMeal(m)}
                    aria-pressed={meal === m}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      meal === m ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent" : "border border-line text-ink-2 hover:bg-surface-3"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${MEAL_COLOR[m].dot}`} />
                    {MEAL_LABEL[m]}
                  </button>
                ))}
              </div>

              {/* How many servings */}
              <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-2.5">
                <span className="text-sm text-ink-2">
                  Servings
                  <span className="ml-2 text-xs text-muted">
                    {(perServing * servings).toLocaleString()} cal
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Fewer servings" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-3 hover:text-ink active:scale-95">
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">{servings}</span>
                  <button onClick={() => setServings((s) => s + 1)} aria-label="More servings" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-3 hover:text-ink active:scale-95">
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {alreadyThere && (
                <p className="mt-3 rounded-xl border border-warn/40 bg-warn/12 px-3 py-2 text-[11px] text-warn-soft">
                  This is already on that day&apos;s {MEAL_LABEL[meal].toLowerCase()}. Adding it again
                  will plan it twice.
                </p>
              )}
            </div>

            <div className="shrink-0 border-t border-line px-5 py-4">
              <button onClick={save} className="btn-accent flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm">
                <CalendarDays size={16} />
                Add to {format(new Date(`${date}T00:00:00`), "EEE, MMM d")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
