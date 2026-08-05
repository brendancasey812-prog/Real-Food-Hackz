"use client";

import { format, isToday } from "date-fns";
import { Flame, BookOpen, ShoppingCart, CalendarDays } from "lucide-react";
import {
  useApp,
  recipeCaloriesPerServing,
  neededQuantities,
} from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";

export default function Dashboard() {
  const { recipes, foods, plan, inventory, goals, setDailyCalorieTarget } = useApp();

  const days = weekDays(new Date());
  const target = goals.dailyCalorieTarget;

  // Calories planned per day this week (real-time, derived from the plan).
  const perDay = days.map((d) => {
    const iso = isoOf(d);
    const cals = plan
      .filter((m) => m.date === iso)
      .reduce((sum, m) => {
        const r = recipes.find((x) => x.id === m.recipeId);
        if (!r) return sum;
        return sum + recipeCaloriesPerServing(r, foods) * m.servings;
      }, 0);
    return { date: d, iso, cals };
  });

  const weekTotal = perDay.reduce((s, d) => s + d.cals, 0);
  const weekTarget = target * 7;
  const maxBar = Math.max(target, ...perDay.map((d) => d.cals), 1);

  // Cross-tab stats.
  const need = neededQuantities(plan.filter((m) => days.some((d) => isoOf(d) === m.date)), recipes);
  const toBuy = Object.entries(need).filter(([foodId, qty]) => {
    const have = inventory.find((i) => i.foodId === foodId)?.quantity ?? 0;
    return qty - have > 0.01;
  }).length;
  const lowStock = inventory.filter((i) => i.quantity <= 2 && foods.find((f) => f.id === i.foodId)?.unit === "each").length;
  const mealsPlanned = perDay.reduce((n, d) => n + plan.filter((m) => m.date === d.iso).length, 0);

  const stats = [
    { label: "Meals planned", value: mealsPlanned, sub: "this week", icon: CalendarDays, color: "text-sky-600" },
    { label: "Recipes", value: recipes.length, sub: "in cookbook", icon: BookOpen, color: "text-violet-600" },
    { label: "To buy", value: toBuy, sub: "grocery items", icon: ShoppingCart, color: "text-amber-600" },
    { label: "Avg / day", value: Math.round(weekTotal / 7), sub: "calories", icon: Flame, color: "text-rose-600" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Week of {format(days[0], "MMM d")} — everything below updates as you plan.
        </p>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <s.icon size={18} className={s.color} />
            <div className="mt-3 text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-zinc-500">
              {s.label} · {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Weekly calorie tracker */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Weekly calorie tracker</h2>
            <p className="text-xs text-zinc-500">
              {weekTotal.toLocaleString()} planned of {weekTarget.toLocaleString()} target kcal
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Daily goal</span>
            <input
              type="number"
              value={target}
              onChange={(e) => setDailyCalorieTarget(Number(e.target.value) || 0)}
              className="w-24 rounded-lg border border-zinc-300 bg-transparent px-2 py-1 text-right dark:border-zinc-700"
            />
          </label>
        </div>

        <div className="flex items-end justify-between gap-2 md:gap-4" style={{ height: 180 }}>
          {perDay.map((d) => {
            const pct = (d.cals / maxBar) * 100;
            const over = d.cals > target;
            return (
              <div key={d.iso} className="flex flex-1 flex-col items-center gap-2">
                <div className="text-[10px] font-medium text-zinc-500">
                  {d.cals > 0 ? d.cals : ""}
                </div>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-lg transition-all ${
                      over ? "bg-rose-400" : "bg-emerald-500"
                    } ${d.cals === 0 ? "bg-zinc-200 dark:bg-zinc-800" : ""}`}
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <div
                  className={`text-xs font-medium ${
                    isToday(d.date) ? "text-emerald-600" : "text-zinc-500"
                  }`}
                >
                  {format(d.date, "EEEEE")}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-emerald-500" /> Within goal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-rose-400" /> Over goal
          </span>
        </div>
      </section>

      {lowStock > 0 && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          ⚠️ {lowStock} item{lowStock > 1 ? "s" : ""} running low — check the Kitchen tab.
        </p>
      )}
    </div>
  );
}
