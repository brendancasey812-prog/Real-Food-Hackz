"use client";

import { useRef, useState } from "react";
import {
  format,
  addDays,
  addMonths,
  addYears,
  isToday,
  isSameMonth,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  getHours,
  getMinutes,
} from "date-fns";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, X, CalendarDays } from "lucide-react";
import { useApp, recipeTotalsPerServing, newId } from "@/lib/store";
import { weekDays, isoOf, monthGrid, MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import {
  MEAL_TIME, MEAL_COLOR, START_HOUR, END_HOUR, HOUR_PX, formatHour, clockLabel,
} from "@/lib/mealtime";
import type { MealType, PlannedMeal, Recipe, Food } from "@/lib/types";

type View = "day" | "week" | "month" | "year";
const VIEWS: View[] = ["day", "week", "month", "year"];

export default function Planner() {
  const { recipes, foods, plan, addPlannedMeal, removePlannedMeal } = useApp();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [picking, setPicking] = useState<{ iso: string; meal: MealType | null } | null>(null);

  const shift = (dir: number) => {
    if (view === "day") setAnchor((a) => addDays(a, dir));
    else if (view === "week") setAnchor((a) => addDays(a, dir * 7));
    else if (view === "month") setAnchor((a) => addMonths(a, dir));
    else setAnchor((a) => addYears(a, dir));
  };

  const title = (() => {
    if (view === "day") return format(anchor, "EEEE, MMMM d, yyyy");
    if (view === "week") {
      const d = weekDays(anchor);
      const sameMonth = d[0].getMonth() === d[6].getMonth();
      return `${format(d[0], "MMM d")} – ${format(d[6], sameMonth ? "d" : "MMM d")}, ${format(d[6], "yyyy")}`;
    }
    if (view === "month") return format(anchor, "MMMM yyyy");
    return format(anchor, "yyyy");
  })();

  const dayMeals = (iso: string) => plan.filter((m) => m.date === iso);
  const openDay = (d: Date) => { setAnchor(d); setView("day"); };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Google-Calendar-style header */}
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-950/40">
            <CalendarDays size={18} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Calendar</h1>
        </div>

        <button
          onClick={() => setAnchor(new Date())}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm font-medium hover:bg-white/[0.07]"
        >
          Today
        </button>

        <div className="flex items-center gap-0.5">
          <button onClick={() => shift(-1)} aria-label="Previous" className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => shift(1)} aria-label="Next" className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100">
            <ChevronRight size={20} />
          </button>
        </div>

        <h2 className="min-w-0 flex-1 truncate text-base font-medium text-zinc-200 md:text-lg">{title}</h2>

        {/* View switcher (top right) — works on phone & web */}
        <div className="ml-auto flex shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs md:text-sm">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1.5 font-medium capitalize transition-colors md:px-3.5 ${
                view === v
                  ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow shadow-emerald-950/40"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      {view === "day" && <TimeGrid days={[anchor]} recipes={recipes} foods={foods} dayMeals={dayMeals} onEmpty={(iso, meal) => setPicking({ iso, meal })} onRemove={removePlannedMeal} />}
      {view === "week" && <TimeGrid days={weekDays(anchor)} recipes={recipes} foods={foods} dayMeals={dayMeals} onEmpty={(iso, meal) => setPicking({ iso, meal })} onRemove={removePlannedMeal} />}
      {view === "month" && <MonthView anchor={anchor} recipes={recipes} dayMeals={dayMeals} onOpenDay={openDay} onAdd={(iso) => setPicking({ iso, meal: null })} />}
      {view === "year" && <YearView anchor={anchor} plan={plan} onOpenDay={openDay} onOpenMonth={(d) => { setAnchor(d); setView("month"); }} />}

      {picking && (
        <AddModal
          iso={picking.iso}
          initialMeal={picking.meal}
          recipes={recipes}
          foods={foods}
          onClose={() => setPicking(null)}
          onPick={(meal, r) => {
            addPlannedMeal({ id: newId(), date: picking.iso, mealType: meal, recipeId: r.id, servings: r.servings });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

// ---------- Shared time grid (Day + Week) ----------

function TimeGrid({
  days, recipes, foods, dayMeals, onEmpty, onRemove,
}: {
  days: Date[];
  recipes: Recipe[];
  foods: Food[];
  dayMeals: (iso: string) => PlannedMeal[];
  onEmpty: (iso: string, meal: MealType) => void;
  onRemove: (id: string) => void;
}) {
  const hours: number[] = [];
  for (let h = START_HOUR; h <= END_HOUR; h++) hours.push(h);
  const gridHeight = (END_HOUR - START_HOUR) * HOUR_PX;
  const now = new Date();
  const nowH = getHours(now) + getMinutes(now) / 60;
  const nowVisible = nowH >= START_HOUR && nowH <= END_HOUR;

  // Auto-scroll to ~7am on mount.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const setScroll = (el: HTMLDivElement | null) => {
    if (el && scrollRef.current !== el) {
      scrollRef.current = el;
      el.scrollTop = (8 - START_HOUR) * HOUR_PX - 12;
    }
  };

  const nearestMeal = (hour: number): MealType => {
    let best: MealType = "breakfast";
    let bestD = Infinity;
    (Object.keys(MEAL_TIME) as MealType[]).forEach((m) => {
      const d = Math.abs(MEAL_TIME[m].start - hour);
      if (d < bestD) { bestD = d; best = m; }
    });
    return best;
  };

  return (
    <div className="overflow-hidden rounded-2xl card">
      {/* Day headers */}
      <div className="flex border-b border-white/[0.07]" style={{ paddingRight: 8 }}>
        <div className="w-14 shrink-0 md:w-16" />
        {days.map((d) => (
          <div key={isoOf(d)} className="flex flex-1 flex-col items-center gap-0.5 border-l border-white/[0.05] py-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{format(d, "EEE")}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isToday(d) ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white" : "text-zinc-200"}`}>
              {format(d, "d")}
            </span>
          </div>
        ))}
      </div>

      {/* Scrollable time area */}
      <div ref={setScroll} className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 250px)" }}>
        <div className="flex" style={{ height: gridHeight }}>
          {/* Hour gutter */}
          <div className="w-14 shrink-0 md:w-16">
            {hours.slice(0, -1).map((h) => (
              <div key={h} className="relative" style={{ height: HOUR_PX }}>
                <span className="absolute -top-2 right-2 text-[10px] text-zinc-500">{formatHour(h)}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const iso = isoOf(d);
            const meals = dayMeals(iso);
            return (
              <div
                key={iso}
                className="relative flex-1 border-l border-white/[0.05]"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const hour = START_HOUR + (e.clientY - rect.top) / HOUR_PX;
                  onEmpty(iso, nearestMeal(hour));
                }}
              >
                {/* Hour lines */}
                {hours.slice(0, -1).map((h) => (
                  <div key={h} className="border-b border-white/[0.05]" style={{ height: HOUR_PX }} />
                ))}

                {/* Now indicator */}
                {nowVisible && isToday(d) && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (nowH - START_HOUR) * HOUR_PX }}>
                    <div className="relative h-0 border-t-2 border-rose-500">
                      <span className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-rose-500" />
                    </div>
                  </div>
                )}

                {/* Meal events */}
                {meals.map((m) => {
                  const r = recipes.find((x) => x.id === m.recipeId);
                  if (!r) return null;
                  const t = MEAL_TIME[m.mealType];
                  const top = (t.start - START_HOUR) * HOUR_PX;
                  const height = Math.max(28, (t.end - t.start) * HOUR_PX);
                  const cal = recipeTotalsPerServing(r, foods).calories * m.servings;
                  const c = MEAL_COLOR[m.mealType];
                  return (
                    <div
                      key={m.id}
                      onClick={(e) => e.stopPropagation()}
                      className={`group absolute inset-x-1 z-10 overflow-hidden rounded-md px-1.5 py-1 text-[11px] shadow-md ${c.block}`}
                      style={{ top, height }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="truncate font-semibold leading-tight">{r.emoji} {r.name}</span>
                        <button onClick={() => onRemove(m.id)} className="shrink-0 opacity-0 transition group-hover:opacity-100" aria-label="Remove">
                          <X size={11} />
                        </button>
                      </div>
                      <div className="truncate opacity-80">{clockLabel(t.start)} · {cal} cal</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t border-white/[0.07] px-4 py-2 text-center text-[11px] text-zinc-500">
        Tap an empty slot to add a meal · tap a meal to remove it
      </div>
    </div>
  );
}

// ---------- Month view ----------

function MonthView({
  anchor, recipes, dayMeals, onOpenDay, onAdd,
}: {
  anchor: Date;
  recipes: Recipe[];
  dayMeals: (iso: string) => PlannedMeal[];
  onOpenDay: (d: Date) => void;
  onAdd: (iso: string) => void;
}) {
  const weeks = monthGrid(anchor);
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="overflow-hidden rounded-2xl card">
      <div className="grid grid-cols-7 border-b border-white/[0.07]">
        {dow.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((d, i) => {
          const iso = isoOf(d);
          const inMonth = isSameMonth(d, anchor);
          const meals = dayMeals(iso);
          return (
            <div
              key={iso}
              className={`group min-h-[92px] border-b border-r border-white/[0.05] p-1.5 ${i % 7 === 6 ? "border-r-0" : ""} ${inMonth ? "" : "bg-black/20"}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  onClick={() => onOpenDay(d)}
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium ${
                    isToday(d) ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white" : inMonth ? "text-zinc-300 hover:bg-white/10" : "text-zinc-600"
                  }`}
                >
                  {format(d, "d")}
                </button>
                <button onClick={() => onAdd(iso)} className="text-zinc-600 opacity-0 transition hover:text-emerald-400 group-hover:opacity-100" aria-label="Add meal">
                  <Plus size={13} />
                </button>
              </div>
              <div className="space-y-0.5">
                {meals.slice(0, 3).map((m) => {
                  const r = recipes.find((x) => x.id === m.recipeId);
                  if (!r) return null;
                  const c = MEAL_COLOR[m.mealType];
                  return (
                    <button key={m.id} onClick={() => onOpenDay(d)} className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] font-medium ${c.soft}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                      <span className="truncate">{r.emoji} {r.name}</span>
                    </button>
                  );
                })}
                {meals.length > 3 && (
                  <button onClick={() => onOpenDay(d)} className="px-1 text-[10px] text-zinc-500 hover:text-zinc-300">
                    +{meals.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Year view ----------

function YearView({
  anchor, plan, onOpenDay, onOpenMonth,
}: {
  anchor: Date;
  plan: PlannedMeal[];
  onOpenDay: (d: Date) => void;
  onOpenMonth: (d: Date) => void;
}) {
  const year = anchor.getFullYear();
  const plannedDates = new Set(plan.map((m) => m.date));
  const dow = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const monthDate = new Date(year, m, 1);
        const gridStart = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
        const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
        // Trim trailing week if fully outside the month.
        const weeksNeeded = Math.ceil(
          (cells.findIndex((d) => isSameDay(d, endOfMonth(monthDate))) + 1) / 7,
        );
        const trimmed = cells.slice(0, weeksNeeded * 7);
        return (
          <div key={m} className="rounded-2xl card p-3">
            <button onClick={() => onOpenMonth(monthDate)} className="mb-2 px-1 text-sm font-semibold text-emerald-400 hover:text-emerald-300">
              {format(monthDate, "MMMM")}
            </button>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {dow.map((d, i) => (
                <span key={i} className="text-[9px] font-medium text-zinc-600">{d}</span>
              ))}
              {trimmed.map((d) => {
                const inMonth = isSameMonth(d, monthDate);
                const has = plannedDates.has(isoOf(d));
                return (
                  <button
                    key={isoOf(d)}
                    onClick={() => onOpenDay(d)}
                    className={`relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${
                      isToday(d)
                        ? "bg-gradient-to-b from-emerald-500 to-emerald-600 font-semibold text-white"
                        : inMonth ? "text-zinc-300 hover:bg-white/10" : "text-zinc-700"
                    }`}
                  >
                    {format(d, "d")}
                    {has && !isToday(d) && inMonth && (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-emerald-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Add-meal modal ----------

function AddModal({
  iso, initialMeal, recipes, foods, onClose, onPick,
}: {
  iso: string;
  initialMeal: MealType | null;
  recipes: Recipe[];
  foods: Food[];
  onClose: () => void;
  onPick: (meal: MealType, r: Recipe) => void;
}) {
  // Which section is expanded (accordion). Default to the tapped slot, else breakfast.
  const [open, setOpen] = useState<MealType>(initialMeal ?? "breakfast");

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="max-h-[82vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-950/95 p-5 md:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Add meal · {format(new Date(iso), "EEE, MMM d")}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X size={20} /></button>
        </div>

        <div className="space-y-2">
          {MEAL_ORDER.map((mt) => {
            const list = recipes.filter((r) => r.category === mt);
            const isOpen = open === mt;
            const c = MEAL_COLOR[mt];
            return (
              <div key={mt} className="overflow-hidden rounded-xl border border-white/10">
                <button
                  onClick={() => setOpen(isOpen ? ("" as MealType) : mt)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.04]"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                    {MEAL_LABEL[mt]}
                    <span className="text-xs font-normal text-zinc-500">{list.length}</span>
                  </span>
                  <ChevronDown size={16} className={`text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="space-y-1 border-t border-white/[0.06] p-2">
                    {list.length === 0 && (
                      <p className="px-2 py-3 text-center text-xs text-zinc-500">No recipes in this section yet.</p>
                    )}
                    {list.map((r) => {
                      const cal = recipeTotalsPerServing(r, foods).calories;
                      return (
                        <button
                          key={r.id}
                          onClick={() => onPick(mt, r)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-500/10"
                        >
                          <span>{r.emoji} {r.name}</span>
                          <span className="text-xs text-zinc-400">{cal} cal</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
