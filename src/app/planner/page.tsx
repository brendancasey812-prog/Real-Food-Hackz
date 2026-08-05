"use client";

import { useState } from "react";
import { format, addDays, addMonths, isToday, isSameMonth } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useApp, recipeCaloriesPerServing, plannedTotals, newId } from "@/lib/store";
import { weekDays, isoOf, monthGrid, MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import type { MealType } from "@/lib/types";

type View = "week" | "month";

export default function Planner() {
  const { recipes, foods, plan, goals, addPlannedMeal, removePlannedMeal } = useApp();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [picking, setPicking] = useState<{ iso: string; meal: MealType } | null>(null);

  const shift = (dir: number) =>
    setAnchor((a) => (view === "week" ? addDays(a, dir * 7) : addMonths(a, dir)));

  const dayCalories = (iso: string) =>
    plannedTotals(plan.filter((m) => m.date === iso), recipes, foods).calories;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Meal planner</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {view === "week"
              ? `${format(weekDays(anchor)[0], "MMM d")} – ${format(weekDays(anchor)[6], "MMM d, yyyy")}`
              : format(anchor, "MMMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border border-zinc-200 p-0.5 text-sm dark:border-zinc-800">
            {(["week", "month"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 font-medium capitalize ${
                  view === v ? "bg-emerald-600 text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded-lg border border-zinc-200 p-2 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setAnchor(new Date())} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800">
              Today
            </button>
            <button onClick={() => shift(1)} className="rounded-lg border border-zinc-200 p-2 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {view === "week" ? (
        <WeekView
          anchor={anchor}
          plan={plan}
          recipes={recipes}
          dayCalories={dayCalories}
          target={goals.dailyCalorieTarget}
          onAdd={(iso, meal) => setPicking({ iso, meal })}
          onRemove={removePlannedMeal}
        />
      ) : (
        <MonthView
          anchor={anchor}
          plan={plan}
          recipes={recipes}
          dayCalories={dayCalories}
          onOpenDay={(d) => { setAnchor(d); setView("week"); }}
        />
      )}

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
                  <span>{r.emoji} {r.name}</span>
                  <span className="text-xs text-zinc-400">{recipeCaloriesPerServing(r, foods)} cal</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Week view ----

interface ViewProps {
  anchor: Date;
  plan: ReturnType<typeof useApp.getState>["plan"];
  recipes: ReturnType<typeof useApp.getState>["recipes"];
  dayCalories: (iso: string) => number;
}

function WeekView({
  anchor, plan, recipes, dayCalories, target, onAdd, onRemove,
}: ViewProps & {
  target: number;
  onAdd: (iso: string, meal: MealType) => void;
  onRemove: (id: string) => void;
}) {
  const days = weekDays(anchor);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[820px] grid-cols-7 gap-2">
        {days.map((d) => {
          const iso = isoOf(d);
          const today = isToday(d);
          const cals = dayCalories(iso);
          return (
            <div key={iso} className="flex flex-col gap-2">
              <div className={`rounded-lg px-2 py-1.5 text-center ${today ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                <div className="text-sm font-medium">{format(d, "EEE d")}</div>
                <div className={`text-[10px] ${today ? "text-emerald-100" : cals > target * 1.05 ? "text-rose-500" : "text-zinc-400"}`}>
                  {cals.toLocaleString()} cal
                </div>
              </div>

              {MEAL_ORDER.map((meal) => {
                const items = plan.filter((m) => m.date === iso && m.mealType === meal);
                return (
                  <div key={meal} className="min-h-[56px] rounded-xl border border-zinc-200 bg-white p-1.5 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                      {MEAL_LABEL[meal]}
                    </div>
                    {items.map((m) => {
                      const r = recipes.find((x) => x.id === m.recipeId);
                      if (!r) return null;
                      return (
                        <div key={m.id} className="group mt-1 flex items-center justify-between gap-1 rounded-lg bg-emerald-50 px-1.5 py-1 text-xs dark:bg-emerald-950/40">
                          <span className="truncate">{r.emoji} {r.name}</span>
                          <button onClick={() => onRemove(m.id)} className="shrink-0 text-emerald-400 opacity-0 transition group-hover:opacity-100">
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                    <button onClick={() => onAdd(iso, meal)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[11px] text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
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
  );
}

// ---- Month view (Google-Calendar style) ----

function MonthView({
  anchor, plan, recipes, dayCalories, onOpenDay,
}: ViewProps & { onOpenDay: (d: Date) => void }) {
  const weeks = monthGrid(anchor);
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 gap-2 pb-2">
          {dow.map((d) => (
            <div key={d} className="text-center text-xs font-semibold uppercase tracking-wide text-zinc-400">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weeks.flat().map((d) => {
            const iso = isoOf(d);
            const inMonth = isSameMonth(d, anchor);
            const meals = plan.filter((m) => m.date === iso);
            const cals = dayCalories(iso);
            return (
              <button
                key={iso}
                onClick={() => onOpenDay(d)}
                className={`flex min-h-[96px] flex-col rounded-xl border p-2 text-left transition hover:border-emerald-400 ${
                  isToday(d) ? "border-emerald-500 ring-1 ring-emerald-500" : "border-zinc-200 dark:border-zinc-800"
                } ${inMonth ? "bg-white dark:bg-zinc-900" : "bg-zinc-50 opacity-60 dark:bg-zinc-900/40"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${isToday(d) ? "text-emerald-600" : ""}`}>{format(d, "d")}</span>
                  {cals > 0 && <span className="text-[10px] text-zinc-400">{(cals / 1000).toFixed(1)}k</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {meals.slice(0, 5).map((m) => {
                    const r = recipes.find((x) => x.id === m.recipeId);
                    return <span key={m.id} className="text-sm leading-none" title={r?.name}>{r?.emoji}</span>;
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
