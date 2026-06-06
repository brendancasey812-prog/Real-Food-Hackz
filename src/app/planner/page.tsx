"use client";

import { useState } from "react";
import { format, addWeeks, isToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useApp, recipeCaloriesPerServing, newId } from "@/lib/store";
import { weekDays, isoOf, MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import type { MealType } from "@/lib/types";

export default function Planner() {
  const { recipes, foods, plan, addPlannedMeal, removePlannedMeal } = useApp();
  const [offset, setOffset] = useState(0);
  const [picking, setPicking] = useState<{ iso: string; meal: MealType } | null>(null);

  const ref = addWeeks(new Date(), offset);
  const days = weekDays(ref);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Meal planner</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {format(days[0], "MMM d")} – {format(days[6], "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="rounded-lg border border-zinc-200 p-2 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setOffset(0)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            Today
          </button>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="rounded-lg border border-zinc-200 p-2 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {/* Calendar grid: 7 day columns × meal rows */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-2">
          {days.map((d) => {
            const iso = isoOf(d);
            const today = isToday(d);
            return (
              <div key={iso} className="flex flex-col gap-2">
                <div
                  className={`rounded-lg px-2 py-1.5 text-center text-sm font-medium ${
                    today
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {format(d, "EEE d")}
                </div>

                {MEAL_ORDER.map((meal) => {
                  const items = plan.filter((m) => m.date === iso && m.mealType === meal);
                  return (
                    <div
                      key={meal}
                      className="min-h-[64px] rounded-xl border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                        {MEAL_LABEL[meal]}
                      </div>
                      {items.map((m) => {
                        const r = recipes.find((x) => x.id === m.recipeId);
                        if (!r) return null;
                        return (
                          <div
                            key={m.id}
                            className="group mt-1 flex items-center justify-between gap-1 rounded-lg bg-emerald-50 px-1.5 py-1 text-xs dark:bg-emerald-950/40"
                          >
                            <span className="truncate">
                              {r.emoji} {r.name}
                            </span>
                            <button
                              onClick={() => removePlannedMeal(m.id)}
                              className="shrink-0 text-emerald-400 opacity-0 transition group-hover:opacity-100"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        onClick={() => setPicking({ iso, meal })}
                        className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[11px] text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Plus size={11} /> add
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {picking && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 dark:bg-zinc-900 md:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">
                Add to {MEAL_LABEL[picking.meal]} · {format(new Date(picking.iso), "EEE MMM d")}
              </h2>
              <button onClick={() => setPicking(null)} className="text-zinc-400">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-1.5">
              {recipes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    addPlannedMeal({
                      id: newId(),
                      date: picking.iso,
                      mealType: picking.meal,
                      recipeId: r.id,
                      servings: r.servings,
                    });
                    setPicking(null);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-200 px-3 py-2.5 text-left text-sm hover:border-emerald-400 hover:bg-emerald-50 dark:border-zinc-800 dark:hover:bg-emerald-950/30"
                >
                  <span>
                    {r.emoji} {r.name}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {recipeCaloriesPerServing(r, foods)} kcal
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
