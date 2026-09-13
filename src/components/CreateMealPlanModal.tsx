"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { X, Wand2, Shuffle, MousePointerClick, ChevronLeft, Search, Check } from "lucide-react";
import { useApp, newId, recipeCaloriesPerServing } from "@/lib/store";
import { householdSize } from "@/lib/household";
import { weekDays, isoOf, MEAL_LABEL, MEAL_CALORIE_SHARE } from "@/lib/week";
import { MEAL_COLOR } from "@/lib/mealtime";
import type { Food, MealType, Recipe } from "@/lib/types";

/** The three sittings a day's plan is built around — snacks are left to the
 *  regular planner, since the wizard is for the meat of the week's plan. */
const PLAN_MEALS: MealType[] = ["breakfast", "lunch", "dinner"];

/** iso date -> meal -> recipe id, staged here until "Save to meal plan". */
type Grid = Record<string, Partial<Record<MealType, string>>>;

/**
 * Build a week of meals in one pass: generate it at random from the
 * Cookbook, sized to the user's own daily calorie goal, or tap through each
 * slot by hand. Either way nothing touches the real calendar until Save —
 * and a day that already has a meal planned is left alone unless you
 * deliberately change it.
 */
export function CreateMealPlanModal({ anchor, onClose }: { anchor: Date; onClose: () => void }) {
  const {
    recipes, foods, plan, goals, householdMode, members,
    addPlannedMeal, updatePlannedMeal, removePlannedMeal,
  } = useApp();
  const size = householdSize({ householdMode, members });
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const cookbook = useMemo(() => recipes.filter((r) => !r.single), [recipes]);
  const dailyTarget = goals.dailyCalorieTarget;

  const [phase, setPhase] = useState<"setup" | "grid">("setup");
  const [chosenDays, setChosenDays] = useState<Set<string>>(() => new Set(days.map(isoOf)));
  const [grid, setGrid] = useState<Grid>({});
  const [slot, setSlot] = useState<{ iso: string; meal: MealType } | null>(null);

  const existingMeal = (iso: string, meal: MealType) =>
    plan.find((m) => m.date === iso && m.mealType === meal);

  const targetFor = (meal: MealType) => dailyTarget * (MEAL_CALORIE_SHARE[meal] ?? 0);

  /** A recipe for this meal slot, weighted toward ones near its calorie share. */
  const pickRandom = (meal: MealType): string | undefined => {
    const cands = cookbook.filter((r) => r.category === meal);
    if (cands.length === 0) return undefined;
    const target = targetFor(meal);
    const scored = cands.map((r) => ({ id: r.id, cal: recipeCaloriesPerServing(r, foods, recipes) }));
    const close = target > 0 ? scored.filter((s) => Math.abs(s.cal - target) <= target * 0.4) : scored;
    const pool = close.length ? close : scored;
    return pool[Math.floor(Math.random() * pool.length)].id;
  };

  const startGrid = (fill: boolean) => {
    const g: Grid = {};
    for (const d of days) {
      const iso = isoOf(d);
      if (!chosenDays.has(iso)) continue;
      g[iso] = {};
      for (const meal of PLAN_MEALS) {
        const ex = existingMeal(iso, meal);
        if (ex) g[iso][meal] = ex.recipeId;
        else if (fill) g[iso][meal] = pickRandom(meal);
      }
    }
    setGrid(g);
    setPhase("grid");
  };

  const fillEmptyRandom = () => {
    setGrid((g) => {
      const next: Grid = { ...g };
      for (const iso of Object.keys(next)) {
        for (const meal of PLAN_MEALS) {
          if (!next[iso][meal]) {
            const pick = pickRandom(meal);
            if (pick) next[iso] = { ...next[iso], [meal]: pick };
          }
        }
      }
      return next;
    });
  };

  const setSlotRecipe = (iso: string, meal: MealType, recipeId: string | undefined) => {
    setGrid((g) => {
      const day = { ...g[iso] };
      if (recipeId) day[meal] = recipeId;
      else delete day[meal];
      return { ...g, [iso]: day };
    });
    setSlot(null);
  };

  /** Sync the staged grid to the real calendar — add, change, or clear only
   *  where the grid actually differs from what's already planned. */
  const save = () => {
    for (const iso of Object.keys(grid)) {
      for (const meal of PLAN_MEALS) {
        const recipeId = grid[iso]?.[meal];
        const ex = existingMeal(iso, meal);
        if (recipeId) {
          if (ex && ex.recipeId !== recipeId) updatePlannedMeal(ex.id, { recipeId, servings: size });
          else if (!ex) addPlannedMeal({ id: newId(), date: iso, mealType: meal, recipeId, servings: size });
        } else if (ex) {
          removePlannedMeal(ex.id);
        }
      }
    }
    onClose();
  };

  const toggleDay = (iso: string) =>
    setChosenDays((s) => {
      const n = new Set(s);
      if (n.has(iso)) n.delete(iso); else n.add(iso);
      return n;
    });

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-page md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold"><Wand2 size={18} className="text-accent-soft" /> Create Meal Plan</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {phase === "setup" && (
            <div className="space-y-5">
              <p className="text-sm text-muted">
                Built from your daily goal of <span className="font-medium text-ink">{Math.round(dailyTarget).toLocaleString()} cal</span>
                {" "}— roughly {Math.round(MEAL_CALORIE_SHARE.breakfast * 100)}% breakfast · {Math.round(MEAL_CALORIE_SHARE.lunch * 100)}% lunch ·{" "}
                {Math.round(MEAL_CALORIE_SHARE.dinner * 100)}% dinner. Recipes come from your Cookbook.
              </p>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Days to plan</div>
                <div className="flex flex-wrap gap-1.5">
                  {days.map((d) => {
                    const iso = isoOf(d);
                    const on = chosenDays.has(iso);
                    return (
                      <button
                        key={iso}
                        onClick={() => toggleDay(iso)}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                          on ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent" : "border border-line text-muted hover:bg-surface-3"
                        }`}
                      >
                        {format(d, "EEE d")}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => startGrid(true)}
                  disabled={chosenDays.size === 0}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-6 text-sm font-medium hover:border-accent hover:bg-accent-wash disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Shuffle size={24} className="text-accent-soft" /> Generate Random
                  <span className="text-xs font-normal text-muted">Fill the week from your Cookbook</span>
                </button>
                <button
                  onClick={() => startGrid(false)}
                  disabled={chosenDays.size === 0}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-6 text-sm font-medium hover:border-accent hover:bg-accent-wash disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <MousePointerClick size={24} className="text-accent-soft" /> Pick &amp; Choose
                  <span className="text-xs font-normal text-muted">Tap each meal yourself</span>
                </button>
              </div>
            </div>
          )}

          {phase === "grid" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <button onClick={() => setPhase("setup")} className="flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
                  <ChevronLeft size={16} /> Back
                </button>
                <button onClick={fillEmptyRandom} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:bg-surface-3">
                  <Shuffle size={13} /> Fill empty slots randomly
                </button>
              </div>

              {days.filter((d) => chosenDays.has(isoOf(d))).map((d) => {
                const iso = isoOf(d);
                return (
                  <div key={iso} className="overflow-hidden rounded-2xl border border-line">
                    <div className="bg-surface px-4 py-2.5 text-sm font-semibold text-ink">{format(d, "EEEE, MMM d")}</div>
                    <div className="divide-y divide-line">
                      {PLAN_MEALS.map((meal) => {
                        const recipeId = grid[iso]?.[meal];
                        const recipe = recipeId ? recipes.find((r) => r.id === recipeId) : undefined;
                        const cal = recipe ? recipeCaloriesPerServing(recipe, foods, recipes) : null;
                        const c = MEAL_COLOR[meal];
                        return (
                          <button
                            key={meal}
                            onClick={() => setSlot({ iso, meal })}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-3"
                          >
                            <span className="flex min-w-0 items-center gap-2 text-sm">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} />
                              <span className="w-16 shrink-0 text-muted">{MEAL_LABEL[meal]}</span>
                              <span className="truncate font-medium text-ink">
                                {recipe ? recipe.name : <span className="font-normal text-muted">+ Add {MEAL_LABEL[meal].toLowerCase()}</span>}
                              </span>
                            </span>
                            {cal != null && <span className="shrink-0 text-xs text-muted">{cal} cal</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2 pt-1">
                <button onClick={onClose} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink-2 hover:bg-surface-3">Cancel</button>
                <button onClick={save} className="flex-1 rounded-xl bg-gradient-to-b from-accent to-accent-deep py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110">
                  Save to meal plan
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {slot && (
        <SlotPicker
          meal={slot.meal}
          date={slot.iso}
          candidates={cookbook.filter((r) => r.category === slot.meal)}
          foods={foods}
          allRecipes={recipes}
          current={grid[slot.iso]?.[slot.meal]}
          onPick={(id) => setSlotRecipe(slot.iso, slot.meal, id)}
          onClear={() => setSlotRecipe(slot.iso, slot.meal, undefined)}
          onClose={() => setSlot(null)}
        />
      )}
    </div>
  );
}

function SlotPicker({
  meal, date, candidates, foods, allRecipes, current, onPick, onClear, onClose,
}: {
  meal: MealType;
  date: string;
  candidates: Recipe[];
  foods: Food[];
  allRecipes: Recipe[];
  current: string | undefined;
  onPick: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = q ? candidates.filter((r) => r.name.toLowerCase().includes(q)) : candidates;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-line bg-page md:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="font-semibold">{MEAL_LABEL[meal]} · {format(new Date(date), "EEE, MMM d")}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>
        <div className="border-b border-line p-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${MEAL_LABEL[meal].toLowerCase()} recipes…`}
              className="w-full rounded-lg field py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {current && (
            <button onClick={onClear} className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger-soft hover:bg-danger/10">
              <X size={14} /> Clear this slot
            </button>
          )}
          {list.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted">
              {candidates.length === 0
                ? `No ${MEAL_LABEL[meal].toLowerCase()} recipes in your Cookbook yet.`
                : `No recipes match “${query}”.`}
            </p>
          )}
          {list.map((r) => {
            const cal = recipeCaloriesPerServing(r, foods, allRecipes);
            return (
              <button
                key={r.id}
                onClick={() => onPick(r.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent-wash ${current === r.id ? "bg-accent-wash" : ""}`}
              >
                <span className="flex items-center gap-2">
                  {current === r.id && <Check size={14} className="text-accent-soft" />}
                  {r.name}
                </span>
                <span className="text-xs text-muted">{cal} cal</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
