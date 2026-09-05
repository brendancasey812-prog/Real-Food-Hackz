"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, X, Check } from "lucide-react";
import { useApp, newId, ingredientCalories } from "@/lib/store";
import { fmtQty, pluralUnit, stepFor } from "@/lib/units";
import type { MealType, Recipe, Unit } from "@/lib/types";

const MEALS: { value: MealType; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "snack", label: "Snack" },
  { value: "dinner", label: "Dinner" },
  { value: "extra", label: "Extra" },
];

/** A sensible opening amount per unit, so most rows need no adjusting. */
const START_QTY: Record<Unit, number> = { each: 1, cup: 1, tbsp: 1, tsp: 1, oz: 4 };

/**
 * The second half of "cook from what I have": the foods picked in the fridge
 * arrive here, each capped at what's actually in stock, and leave as a recipe
 * in the Cookbook.
 */
export function RecipeBuilderSheet({
  foodIds, onClose, onSaved
}: {
  foodIds: string[];
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const { foods, inventory, addRecipe } = useApp();

  const picked = useMemo(
    () => foodIds.map((id) => foods.find((f) => f.id === id)).filter((f) => f != null),
    [foodIds, foods],
  );

  const onHand = (id: string) => inventory.find((i) => i.foodId === id)?.quantity ?? 0;

  const [name, setName] = useState("");
  const [meal, setMeal] = useState<MealType>("dinner");
  const [servings, setServings] = useState(1);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      picked.map((f) => [f.id, Math.min(onHand(f.id), START_QTY[f.unit])]),
    ),
  );

  const ingredients = picked
    .map((f) => ({ foodId: f.id, quantity: qty[f.id] ?? 0 }))
    .filter((i) => i.quantity > 0);

  const totalCal = ingredients.reduce((sum, i) => sum + ingredientCalories(i, foods), 0);
  const perServing = Math.round(totalCal / Math.max(1, servings));
  const canSave = name.trim().length > 0 && ingredients.length > 0;

  const set = (id: string, v: number, max: number) =>
    setQty((s) => ({ ...s, [id]: Math.max(0, Math.min(max, Number(v.toFixed(2)))) }));

  const save = () => {
    if (!canSave) return;
    const recipe: Recipe = {
      id: newId(),
      name: name.trim(),
      servings: Math.max(1, servings),
      ingredients,
      steps: [],
      category: meal
    };
    addRecipe(recipe);
    onSaved(recipe.name);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-scrim backdrop-blur-sm md:items-center md:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="sheet-up flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-3xl border border-line bg-page md:rounded-3xl"
      >
        <div className="shrink-0 px-5 pt-4">
          <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-line-2 md:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">New recipe</h2>
              <p className="text-xs text-muted">
                From {picked.length} {picked.length === 1 ? "ingredient" : "ingredients"} in your fridge
              </p>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Name */}
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Recipe name"
              aria-label="Recipe name"
              autoFocus
              className="flex-1 rounded-xl field px-3 py-2.5 text-sm"
            />
          </div>

          {/* Meal slot */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {MEALS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMeal(m.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  meal === m.value
                    ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent"
                    : "border border-line text-ink-2 hover:bg-surface-3"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Servings */}
          <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-2.5">
            <span className="text-sm text-ink-2">Servings</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                aria-label="Fewer servings"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-3 hover:text-ink active:scale-95"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums">{servings}</span>
              <button
                onClick={() => setServings((s) => s + 1)}
                aria-label="More servings"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-3 hover:text-ink active:scale-95"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Ingredient amounts, capped at what's in the fridge */}
          <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            How much of each
          </p>
          <div className="space-y-1.5">
            {picked.map((f) => {
              const have = onHand(f.id);
              const step = stepFor(f.unit);
              const v = qty[f.id] ?? 0;
              const cal = ingredientCalories({ foodId: f.id, quantity: v }, foods);
              return (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{f.name}</span>
                    <span className="block text-[11px] text-muted tabular-nums">
                      {fmtQty(have)} {pluralUnit(have, f.unit)} on hand · {cal} cal
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => set(f.id, v - step, have)}
                      aria-label={`Less ${f.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:bg-surface-3 hover:text-ink active:scale-95"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-16 text-center text-sm font-semibold tabular-nums text-ink">
                      {fmtQty(v)}
                      <span className="block text-[10px] font-normal text-muted">
                        {pluralUnit(v, f.unit)}
                      </span>
                    </span>
                    <button
                      onClick={() => set(f.id, v + step, have)}
                      disabled={v >= have}
                      aria-label={`More ${f.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:bg-surface-3 hover:text-ink active:scale-95 disabled:opacity-35 disabled:hover:bg-transparent"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Amounts stop at what you have in the fridge.
          </p>
        </div>

        {/* Totals + save */}
        <div className="shrink-0 border-t border-line px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted">
              {ingredients.length} of {picked.length} used
            </span>
            <span className="font-semibold text-cal-soft tabular-nums">
              {perServing.toLocaleString()} cal / serving
              <span className="ml-2 font-normal text-muted">{totalCal.toLocaleString()} total</span>
            </span>
          </div>
          <button
            onClick={save}
            disabled={!canSave}
            className="btn-accent flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={16} /> Add to Cookbook
          </button>
          {!canSave && (
            <p className="mt-2 text-center text-[11px] text-muted">
              {name.trim() ? "Give at least one ingredient an amount." : "Name the recipe to save it."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
