"use client";

import { useState } from "react";
import { format, isToday } from "date-fns";
import Link from "next/link";
import { Flame, Beef, Wheat, Droplet, User, Settings, DollarSign } from "lucide-react";
import { useApp, plannedTotals, household, combinedGoals } from "@/lib/store";
import { weekDays, isoOf } from "@/lib/week";
import { SettingsModal, HOUSEHOLD_LABEL } from "@/components/SettingsModal";
import { BASE_STORE_ID, plannedCost, fmtMoney } from "@/lib/cost";

export default function Dashboard() {
  const { recipes, foods, plan, goals, profile, members, householdMode, setGoals,
    prices, stores, selectedStoreId } = useApp();
  const [settingsOpen, setSettingsOpen] = useState(false);
  // "all" = the whole household; otherwise a single eater's id ("me" or member id).
  const [scope, setScope] = useState<string>("all");

  const eaters = household({ goals, profile, members });
  const multi = householdMode !== "individual" && eaters.length > 1;
  const shown = !multi || scope === "all" ? eaters : eaters.filter((e) => e.id === scope);
  const activeGoals = multi ? combinedGoals(shown) : goals;

  const days = weekDays(new Date());
  const target = activeGoals.dailyCalorieTarget;

  // Per-day calorie + macro totals for this week (derived live from the calendar).
  const perDay = days.map((d) => {
    const iso = isoOf(d);
    const meals = plan.filter((m) => m.date === iso);
    return { date: d, iso, meals: meals.length, ...plannedTotals(meals, recipes, foods) };
  });

  const todayCol = perDay.find((d) => isToday(d.date)) ?? perDay[0];

  // Money twin of the calorie roll-up above, costed at the selected store.
  const weekIsos = days.map(isoOf);
  const weekCost = plannedCost(plan.filter((m) => weekIsos.includes(m.date)), recipes, prices, selectedStoreId);
  const todayCost = plannedCost(plan.filter((m) => m.date === todayCol.iso), recipes, prices, selectedStoreId);
  const costStore =
    selectedStoreId === BASE_STORE_ID
      ? "base prices"
      : (stores.find((st) => st.id === selectedStoreId)?.name ?? "base prices");
  const weekTotal = perDay.reduce((s, d) => s + d.calories, 0);
  const maxBar = Math.max(target, ...perDay.map((d) => d.calories)) * 1.12;
  const targetPct = (target / maxBar) * 100;

  const macros = [
    { key: "protein", label: "Protein", value: todayCol.protein, target: activeGoals.proteinTarget, icon: Beef, bar: "bg-gradient-to-r from-rose-500 to-rose-400", text: "text-rose-400" },
    { key: "carbs", label: "Carbs", value: todayCol.carbs, target: activeGoals.carbsTarget, icon: Wheat, bar: "bg-gradient-to-r from-amber-500 to-amber-400", text: "text-amber-400" },
    { key: "fat", label: "Fat", value: todayCol.fat, target: activeGoals.fatTarget, icon: Droplet, bar: "bg-gradient-to-r from-sky-500 to-sky-400", text: "text-sky-400" },
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
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-end gap-2">
            {/* Household mode — sits above the body measurements */}
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-emerald-300">
              {HOUSEHOLD_LABEL[householdMode]}
            </span>
            {/* Profile card */}
            <div className="flex items-center gap-3 rounded-xl card px-4 py-2.5 text-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <User size={18} />
            </span>
              <div>
                <div className="font-medium">{ft}&apos;{inch}&quot; · {profile.weightLb} lb · {profile.age}</div>
                <div className="text-xs text-zinc-500">{profile.activity} · {goals.dailyCalorieTarget.toLocaleString()} cal/day</div>
              </div>
            </div>
          </div>
          {/* Settings */}
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-xl card text-zinc-300 transition-colors hover:text-emerald-300"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Household filter — total vs. one person */}
      {multi && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Showing goals for</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setScope("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === "all" ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white" : "border border-white/10 text-zinc-300 hover:bg-white/[0.06]"
              }`}
            >
              Everyone ({eaters.length})
            </button>
            {eaters.map((e) => (
              <button
                key={e.id}
                onClick={() => setScope(e.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  scope === e.id ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white" : "border border-white/10 text-zinc-300 hover:bg-white/[0.06]"
                }`}
              >
                {e.name || "Member"}
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* Food spend — the same plan, costed */}
      <section className="mt-6 rounded-2xl card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Food spend</h2>
            <p className="text-xs text-zinc-500">
              This week&apos;s plan at {costStore}
              {weekCost.lines - weekCost.priced > 0 && (
                <span className="text-amber-400/90">
                  {" "}· {weekCost.lines - weekCost.priced} ingredient lines still unpriced
                </span>
              )}
            </p>
          </div>
          <Link
            href="/costs"
            className="rounded-lg px-3 py-1.5 text-xs font-medium field hover:brightness-125"
          >
            Edit prices
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SpendStat label="This week" value={weekCost.priced > 0 ? fmtMoney(weekCost.cost) : "—"} />
          <SpendStat label="Today" value={todayCost.priced > 0 ? fmtMoney(todayCost.cost) : "—"} />
          <SpendStat
            label="Avg / day"
            value={weekCost.priced > 0 ? fmtMoney(weekCost.cost / 7) : "—"}
          />
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
          {multi && scope === "all" ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Household goal</span>
              <span className="rounded-lg border border-white/10 px-2.5 py-1 font-medium text-zinc-200">{target.toLocaleString()}</span>
              <span className="text-xs text-zinc-500">= {shown.length} people</span>
            </span>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Daily goal</span>
              <input
                type="number"
                value={target}
                onChange={(e) => setGoals({ dailyCalorieTarget: Number(e.target.value) || 0 })}
                className="w-24 rounded-lg field px-2 py-1 text-right"
                disabled={multi && scope !== "me"}
              />
            </label>
          )}
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

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function SpendStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        <DollarSign size={12} /> {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-emerald-400">{value}</div>
    </div>
  );
}
