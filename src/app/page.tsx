"use client";

import { useState } from "react";
import { addWeeks, format, isToday } from "date-fns";
import { Flame, Beef, Wheat, Droplet, User, ChevronLeft, ChevronRight } from "lucide-react";
import { useApp, plannedTotals, household, combinedGoals, recipeTotalsPerServing } from "@/lib/store";
import { weekDays, isoOf, MEAL_LABEL } from "@/lib/week";
import { mealStart, clockLabel } from "@/lib/mealtime";
import { recipeCostPerServing, fmtMoney } from "@/lib/cost";
import { HOUSEHOLD_LABEL } from "@/lib/household";
import { SettingsButton } from "@/components/SettingsButton";
import { MealDetailModal } from "@/components/MealDetailModal";

export default function Dashboard() {
  const { recipes, foods, plan, goals, profile, members, householdMode, setGoals, prices, selectedStoreId } = useApp();
  // "all" = the whole household; otherwise a single eater's id ("me" or member id).
  const [scope, setScope] = useState<string>("all");
  // Which week the whole page is reporting on, like the Meal Plan.
  const [weekOffset, setWeekOffset] = useState(0);
  // Which day the "today" panels describe. Null follows today; clicking a bar
  // in the chart pins another day, which is the only way to inspect a day on a
  // week that doesn't contain today.
  const [focusIso, setFocusIso] = useState<string | null>(null);
  // Tapping a meal on the focused day opens it, prices and all.
  const [openMealId, setOpenMealId] = useState<string | null>(null);

  // Who this dashboard is about. On "individual" the members are somebody
  // else's problem — the plan is for one person and so is every figure here.
  const eaters = householdMode === "individual"
    ? household({ goals, profile, members }).slice(0, 1)
    : household({ goals, profile, members });
  const multi = eaters.length > 1;
  const shown = !multi || scope === "all" ? eaters : eaters.filter((e) => e.id === scope);
  const activeGoals = combinedGoals(shown);

  /**
   * How much of the food on the calendar belongs to whoever is selected.
   *
   * A planned meal records servings, not who ate them, so one person's share
   * has to be worked out — and splitting it evenly would tell a 2,500-calorie
   * eater they are eating the same as a 1,900-calorie one. Their share is
   * their target out of the household's, so the numbers here are built out of
   * the calories actually set for each person in Settings. Everyone selected
   * is a share of 1, and the totals are the household's own.
   */
  const householdTarget = combinedGoals(eaters).dailyCalorieTarget;
  const share =
    !multi || scope === "all" || householdTarget <= 0
      ? 1
      : activeGoals.dailyCalorieTarget / householdTarget;

  const days = weekDays(addWeeks(new Date(), weekOffset));
  const target = activeGoals.dailyCalorieTarget;

  // Per-day calorie + macro totals for this week, cut to the selected eater's
  // share so the bars and the goal line are measuring the same person.
  const perDay = days.map((d) => {
    const iso = isoOf(d);
    const meals = plan.filter((m) => m.date === iso);
    const t = plannedTotals(meals, recipes, foods);
    return {
      date: d,
      iso,
      meals: meals.length,
      calories: Math.round(t.calories * share),
      protein: Math.round(t.protein * share),
      carbs: Math.round(t.carbs * share),
      fat: Math.round(t.fat * share),
    };
  });

  const focusCol =
    perDay.find((d) => d.iso === focusIso) ??
    perDay.find((d) => isToday(d.date)) ??
    perDay[0];
  const focusIsToday = isToday(focusCol.date);
  const thisWeek = weekOffset === 0;

  const goWeek = (dir: number) => {
    setWeekOffset((w) => w + dir);
    setFocusIso(null);
  };

  const weekTotal = perDay.reduce((s, d) => s + d.calories, 0);
  const maxBar = Math.max(target, ...perDay.map((d) => d.calories)) * 1.12;
  const targetPct = (target / maxBar) * 100;

  const macros = [
    { key: "protein", label: "Protein", value: focusCol.protein, target: activeGoals.proteinTarget, icon: Beef, bar: "bg-gradient-to-r from-protein-deep to-protein", text: "text-protein-soft" },
    { key: "carbs", label: "Carbs", value: focusCol.carbs, target: activeGoals.carbsTarget, icon: Wheat, bar: "bg-gradient-to-r from-carbs-deep to-carbs", text: "text-carbs-soft" },
    { key: "fat", label: "Fat", value: focusCol.fat, target: activeGoals.fatTarget, icon: Droplet, bar: "bg-gradient-to-r from-fat-deep to-fat", text: "text-fat-soft" },
  ];

  // What is actually on the focused day, in the order it gets eaten. Calories
  // follow the selected eater's share; the price of a serving is the price of a
  // serving, so that one doesn't move.
  const focusMeals = plan
    .filter((m) => m.date === focusCol.iso)
    .map((m) => {
      const recipe = recipes.find((r) => r.id === m.recipeId);
      if (!recipe) return null;
      const per = recipeTotalsPerServing(recipe, foods, recipes);
      const cost = recipeCostPerServing(recipe, recipes, prices, selectedStoreId);
      return {
        meal: m,
        recipe,
        calories: Math.round(per.calories * m.servings * share),
        cost,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => mealStart(a.meal) - mealStart(b.meal));

  /**
   * What the day comes to: its calories, and what the food on it cost.
   *
   * This is a total of the day in front of you, not a forecast — the same
   * prices already on each row, added up, and it says so when a meal has an
   * ingredient with no price rather than quietly reporting less.
   */
  const dayTotal = focusMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      cost: acc.cost + m.cost.cost * m.meal.servings * share,
      priced: acc.priced + (m.cost.priced > 0 ? 1 : 0),
      short: acc.short + (m.cost.lines > m.cost.priced ? 1 : 0),
    }),
    { calories: 0, cost: 0, priced: 0, short: 0 },
  );

  const ft = Math.floor(profile.heightIn / 12);
  const inch = profile.heightIn % 12;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Dashboard</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5">
              <button onClick={() => goWeek(-1)} aria-label="Previous week" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-ink">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => goWeek(1)} aria-label="Next week" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-3 hover:text-ink">
                <ChevronRight size={16} />
              </button>
            </div>
            <span className="text-sm text-muted">
              Week of {format(days[0], "MMM d")}
              {!thisWeek && <span className="text-faint"> · {format(days[6], "MMM d, yyyy")}</span>}
            </span>
            {!thisWeek && (
              <button
                onClick={() => { setWeekOffset(0); setFocusIso(null); }}
                className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 hover:bg-surface-3"
              >
                This week
              </button>
            )}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-end gap-2">
            {/* Household mode — sits above the body measurements */}
            <span className="rounded-lg border border-accent bg-accent-wash px-3 py-1 text-xs font-semibold tracking-wide text-accent-soft">
              {HOUSEHOLD_LABEL[householdMode]}
            </span>
            {/* Profile card */}
            <div className="flex items-center gap-3 rounded-xl card px-4 py-2.5 text-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-wash text-accent-soft">
              <User size={18} />
            </span>
              <div>
                <div className="font-medium">{ft}&apos;{inch}&quot; · {profile.weightLb} lb · {profile.age}</div>
                <div className="text-xs text-muted">{profile.activity} · {goals.dailyCalorieTarget.toLocaleString()} cal/day</div>
              </div>
            </div>
          </div>
          {/* Settings */}
          <SettingsButton className="hidden md:flex" />
        </div>
      </header>

      {/* Household filter — total vs. one person */}
      {multi && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Showing goals for</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setScope("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                scope === "all" ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent" : "border border-line text-ink-2 hover:bg-surface-3"
              }`}
            >
              Everyone ({eaters.length})
            </button>
            {eaters.map((e) => (
              <button
                key={e.id}
                onClick={() => setScope(e.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  scope === e.id ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent" : "border border-line text-ink-2 hover:bg-surface-3"
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
            {focusIsToday
              ? `Today · ${format(focusCol.date, "EEEE")}`
              : format(focusCol.date, "EEEE, MMM d")}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-cal/12 px-3 py-1 text-sm font-semibold text-cal-soft">
            <Flame size={14} /> {focusCol.calories.toLocaleString()} / {target.toLocaleString()} cal
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
                  <span className="text-muted">
                    {m.value} / {m.target} g
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-track">
                  <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {/* What the whole day comes to */}
        {focusMeals.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {focusMeals.length} {focusMeals.length === 1 ? "meal" : "meals"} · day total
            </span>
            <span className="flex items-baseline gap-3 text-sm">
              <span className="font-semibold text-cal-soft tabular-nums">
                {dayTotal.calories.toLocaleString()} cal
              </span>
              {dayTotal.priced > 0 && (
                <span className="font-semibold text-accent-soft tabular-nums">
                  {fmtMoney(dayTotal.cost)}
                  {dayTotal.short > 0 && (
                    <span className="ml-1 text-[11px] font-normal text-warn-soft">
                      {dayTotal.short} {dayTotal.short === 1 ? "meal is" : "meals are"} missing a price
                    </span>
                  )}
                </span>
              )}
            </span>
          </div>
        )}

        {/* The day's meals — tap one for its ingredients and their prices */}
        <div className="mt-5 border-t border-line pt-4">
          {focusMeals.length === 0 ? (
            <p className="text-sm text-muted">Nothing planned for this day yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {focusMeals.map(({ meal, recipe, calories, cost }) => (
                <li key={meal.id}>
                  <button
                    onClick={() => setOpenMealId(meal.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-3"
                  >
                    <span className="w-16 shrink-0 text-xs font-medium text-muted">
                      {clockLabel(mealStart(meal))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{recipe.name}</span>
                      <span className="block text-xs text-muted">
                        {MEAL_LABEL[meal.mealType] ?? meal.mealType} · {meal.servings} serving{meal.servings === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold text-cal-soft">
                        {calories.toLocaleString()} cal
                      </span>
                      {cost.priced > 0 && (
                        <span className="block text-xs text-muted">
                          {fmtMoney(cost.cost)} a serving
                        </span>
                      )}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-faint" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Weekly calorie bar chart with target line */}
      <section className="mt-6 rounded-2xl card p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Weekly calories</h2>
            <p className="text-xs text-muted">
              {weekTotal.toLocaleString()} planned · {Math.round(weekTotal / 7).toLocaleString()} avg/day
              {multi && (
                <span className="text-faint">
                  {" "}· {scope === "all" ? `all ${eaters.length}` : (shown[0]?.name || "one eater")}
                </span>
              )}
            </p>
          </div>
          {multi && scope === "all" ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-muted">Household goal</span>
              <span className="rounded-lg border border-line px-2.5 py-1 font-medium text-ink">{target.toLocaleString()}</span>
              <span className="text-xs text-muted">= {shown.length} people</span>
            </span>
          ) : (
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">Daily goal</span>
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
            className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-accent"
            style={{ bottom: `${targetPct}%` }}
          >
            <span className="absolute -top-2.5 right-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-on-accent">
              goal {target.toLocaleString()}
            </span>
          </div>

          <div className="flex h-full items-end justify-between gap-2 md:gap-4">
            {perDay.map((d) => {
              const pct = (d.calories / maxBar) * 100;
              const over = d.calories > target * 1.05;
              const under = d.calories < target * 0.9;
              const color = over
                ? "bg-gradient-to-t from-over-deep to-over"
                : under
                ? "bg-gradient-to-t from-under-deep to-under"
                : "bg-gradient-to-t from-accent-deep to-accent";
              const isFocus = d.iso === focusCol.iso;
              const marked = isToday(d.date) || isFocus;
              return (
                <button
                  key={d.iso}
                  onClick={() => setFocusIso(d.iso)}
                  aria-pressed={isFocus}
                  title={`Show ${format(d.date, "EEEE, MMM d")}`}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className={`text-[10px] font-medium ${marked ? "text-accent-soft" : "text-muted"}`}>
                    {d.calories > 0 ? d.calories.toLocaleString() : ""}
                  </span>
                  <span
                    className={`w-full rounded-t-lg transition-all ${d.calories === 0 ? "bg-surface-2" : color} ${
                      isFocus ? "ring-2 ring-accent ring-offset-2 ring-offset-transparent" : ""
                    }`}
                    style={{ height: `${Math.max(pct, 1)}%` }}
                  />
                  <span className={`text-xs font-medium ${marked ? "text-accent-soft" : "text-muted"}`}>
                    {format(d.date, "EEEEE")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-accent" /> On target</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-under" /> Under</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-over" /> Over</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0 w-4 border-t-2 border-dashed border-accent" /> Daily goal</span>
        </div>
      </section>

      {openMealId && <MealDetailModal mealId={openMealId} onClose={() => setOpenMealId(null)} />}
    </div>
  );
}

