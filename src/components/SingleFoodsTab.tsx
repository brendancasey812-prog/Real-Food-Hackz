"use client";

import { useMemo, useState } from "react";
import { Flame, CalendarPlus, Search, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { priceFor, fmtMoney } from "@/lib/cost";
import { unitLabel, pluralUnit, fmtQty } from "@/lib/units";
import { AddToPlanSheet } from "./AddToPlanSheet";
import type { Food, FoodCategory, Recipe } from "@/lib/types";

/**
 * Single foods you eat on their own — an apple, a banana, an orange — with what
 * one of them costs and what it does to your day, and a way to drop it straight
 * onto the calendar.
 *
 * The Meal Plan only schedules *recipes*, so planning a bare food means giving
 * it a recipe to travel in: a one-ingredient stand-in marked `single`, created
 * the first time you plan that food and reused every time after. It is filtered
 * out of the Cookbook's recipe lists so it never clutters them, but it costs and
 * counts calories through exactly the same machinery as anything else.
 */
export function SingleFoodsTab({ category = "fruit" }: { category?: FoodCategory }) {
  const { foods, recipes, prices, selectedStoreId, inventory, addRecipe } = useApp();
  const [query, setQuery] = useState("");
  const [planning, setPlanning] = useState<{ recipe: Recipe; noun: string } | null>(null);

  const q = query.trim().toLowerCase();

  const list = useMemo(
    () =>
      foods
        .filter((f) => f.category === category)
        .filter((f) => (q ? f.name.toLowerCase().includes(q) : true))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [foods, category, q],
  );

  const qtyOf = (id: string) => inventory.find((i) => i.foodId === id)?.quantity ?? 0;

  /** The label for "one of these": Apples, or Cups for anything measured out. */
  const nounFor = (f: Food) =>
    f.unit === "each" ? f.name : `${pluralUnit(2, f.unit)[0].toUpperCase()}${pluralUnit(2, f.unit).slice(1)}`;

  const plan = (f: Food) => {
    const id = `single-${f.id}`;
    const existing = recipes.find((r) => r.id === id);
    const recipe: Recipe = existing ?? {
      id,
      name: f.name,
      servings: 1,
      ingredients: [{ foodId: f.id, quantity: 1 }],
      steps: [],
      category: "snack",
      single: true
    };
    if (!existing) addRecipe(recipe);
    setPlanning({ recipe, noun: nounFor(f) });
  };

  return (
    <>
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search fruit…"
          className="field w-full rounded-xl py-2 pl-9 pr-8 text-sm"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">
          {q ? `No fruit matches “${query}”.` : "No fruit yet — add some in the Food Tracker."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((f) => {
            const price = priceFor(prices, selectedStoreId, f.id);
            const have = qtyOf(f.id);
            return (
              <div
                key={f.id}
                onClick={() => plan(f)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); plan(f); } }}
                className="card flex cursor-pointer flex-col rounded-2xl p-5 transition-colors hover:border-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-right text-xs text-muted">
                    per {unitLabel(f.unit)}
                    {have > 0 && (
                      <span className="block text-accent-soft">
                        {fmtQty(have)} {pluralUnit(have, f.unit)} on hand
                      </span>
                    )}
                  </span>
                </div>

                <h3 className="mt-2 font-semibold">{f.name}</h3>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-cal/12 px-2.5 py-1 text-xs font-semibold text-cal-soft">
                    <Flame size={12} /> {Math.round(f.caloriesPerUnit).toLocaleString()} cal
                  </span>
                  {price ? (
                    <span className="text-xs font-semibold text-accent-soft">
                      {fmtMoney(price.pricePerUnit)}
                      {price.source === "base" && <span className="ml-1 font-normal text-muted">est.</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-warn-soft">no price yet</span>
                  )}
                </div>

                <div className="mt-2 flex gap-1.5 text-[11px]">
                  <span className="rounded-md bg-protein/15 px-2 py-0.5 font-medium text-protein-soft">P {f.protein}g</span>
                  <span className="rounded-md bg-carbs/15 px-2 py-0.5 font-medium text-carbs-soft">C {f.carbs}g</span>
                  <span className="rounded-md bg-fat/15 px-2 py-0.5 font-medium text-fat-soft">F {f.fat}g</span>
                </div>

                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent-soft">
                  <CalendarPlus size={15} /> Add to plan
                </span>
              </div>
            );
          })}
        </div>
      )}

      {planning && (
        <AddToPlanSheet
          recipe={planning.recipe}
          servingNoun={planning.noun}
          onClose={() => setPlanning(null)}
        />
      )}
    </>
  );
}
