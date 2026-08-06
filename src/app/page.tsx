"use client";

import { format, isToday } from "date-fns";
import { Flame, Beef, Wheat, Droplet, User } from "lucide-react";
import { useApp, plannedTotals } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";

export default function Dashboard() {
  const { recipes, foods, plan, goals, profile, setGoals } = useApp();

  const days = weekDays(new Date());
  const target = goals.dailyCalorieTarget;

  // Per-day calorie + macro totals for this week (derived live from the calendar).
  const perDay = days.map((d) => {
    const iso = isoOf(d);
    const meals = plan.filter((m) => m.date === iso);
    return { date: d, iso, meals: meals.length, ...plannedTotals(meals, recipes, foods) };
  });

  const todayCol = perDay.find((d) => isToday(d.date)) ?? perDay[0];
  const weekTotal = perDay.reduce((s, d) => s + d.calories, 0);
  const maxBar = Math.max(target, ...perDay.map((d) => d.calories)) * 1.12;
  const targetPct = (target / maxBar) * 100;

  const macros = [
    { key: "protein", label: "Protein", value: todayCol.protein, target: goals.proteinTarget, icon: Beef, bar: "bg-gradient-to-r from-rose-500 to-rose-400", text: "text-rose-400" },
    { key: "carbs", label: "Carbs", value: todayCol.carbs, target: goals.carbsTarget, icon: Wheat, bar: "bg-gradient-to-r from-amber-500 to-amber-400", text: "text-amber-400" },
    { key: "fat", label: "Fat", value: todayCol.fat, target: goals.fatTarget, icon: Droplet, bar: "bg-gradient-to-r from-sky-500 to-sky-400", text: "text-sky-400" },
  ];

  const ft = Math.floor(profile.heightIn / 12);
  const inch = profile.heightIn % 12;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Week of {format(days[0], "MMM d")} — updates live as you change the plan.
          </p>
        </div>
        {/* Profile card */}
        <div className="flex items-center gap-3 rounded-xl card px-4 py-2.5 text-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <User size={18} />
          </span>
          <div>
            <div className="font-medium">{ft}&apos;{inch}&quot; · {profile.weightLb} lb · {profile.age}</div>
            <div className="text-xs text-zinc-500">{profile.activity} · {target.toLocaleString()} cal/day</div>
          </div>
        </div>
      </header>

      {/* Today's targets */}
      <section className="rounded-2xl card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">
            Today · {format(todayCol.date, "EEEE")}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
            <Flame size={14} /> {todayCol.calories.toLocaleString()} / {target.toLocaleString()} cal
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {macros.map((m) => {
            const pct = Math.min(100, (m.value / m.target) * 100);
            return (
              <div key={m.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <m.icon size={14} className={m.text} /> {m.label}
                  </span>
                  <span className="text-zinc-500">
                    {m.value} / {m.target} g
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Weekly calorie bar chart with target line */}
      <section className="mt-6 rounded-2xl card p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Weekly calories</h2>
            <p className="text-xs text-zinc-500">
              {weekTotal.toLocaleString()} planned · {Math.round(weekTotal / 7).toLocaleString()} avg/day
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-500">Daily goal</span>
            <input
              type="number"
              value={target}
              onChange={(e) => setGoals({ dailyCalorieTarget: Number(e.target.value) || 0 })}
              className="w-24 rounded-lg field px-2 py-1 text-right"
            />
          </label>
        </div>

        <div className="relative" style={{ height: 200 }}>
          {/* Target line */}
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-emerald-500"
            style={{ bottom: `${targetPct}%` }}
          >
            <span className="absolute -top-2.5 right-0 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              goal {target.toLocaleString()}
            </span>
          </div>

          <div className="flex h-full items-end justify-between gap-2 md:gap-4">
            {perDay.map((d) => {
              const pct = (d.calories / maxBar) * 100;
              const over = d.calories > target * 1.05;
              const under = d.calories < target * 0.9;
              const color = over
                ? "bg-gradient-to-t from-rose-600 to-rose-400 shadow-[0_0_24px_-6px_rgba(244,63,94,0.6)]"
                : under
                ? "bg-gradient-to-t from-amber-600 to-amber-400 shadow-[0_0_24px_-6px_rgba(245,158,11,0.5)]"
                : "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)]";
              return (
                <div key={d.iso} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <div className={`text-[10px] font-medium ${isToday(d.date) ? "text-emerald-300" : "text-zinc-500"}`}>
                    {d.calories > 0 ? d.calories.toLocaleString() : ""}
                  </div>
                  <div
                    className={`w-full rounded-t-lg transition-all ${d.calories === 0 ? "bg-white/5" : color}`}
                    style={{ height: `${Math.max(pct, 1)}%` }}
                  />
                  <div
                    className={`text-xs font-medium ${isToday(d.date) ? "text-emerald-400" : "text-zinc-500"}`}
                  >
                    {format(d.date, "EEEEE")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-emerald-500" /> On target</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-amber-400" /> Under</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-rose-400" /> Over</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dashed border-emerald-500" /> Daily goal</span>
        </div>
      </section>
    </div>
  );
}
