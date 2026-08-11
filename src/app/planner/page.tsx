"use client";

import { useEffect, useRef, useState } from "react";
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
import { ChevronLeft, ChevronRight, ChevronDown, Plus, X, CalendarDays, Search, CalendarPlus, UtensilsCrossed } from "lucide-react";
import { useApp, recipeTotalsPerServing, newId } from "@/lib/store";
import { weekDays, isoOf, monthGrid, MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import {
  MEAL_COLOR, EVENT_COLOR, mealStart, mealEnd, snapHour,
  START_HOUR, END_HOUR, HOUR_PX, formatHour, clockLabel,
} from "@/lib/mealtime";
import type { MealType, PlannedMeal, CalendarEvent, Recipe, Food } from "@/lib/types";

type View = "day" | "week" | "month" | "year";
const VIEWS: View[] = ["day", "week", "month", "year"];

export default function Planner() {
  const {
    recipes, foods, plan, events,
    addPlannedMeal, updatePlannedMeal, removePlannedMeal,
    addEvent, updateEvent, removeEvent,
  } = useApp();
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [picking, setPicking] = useState<{ iso: string; hour: number | null } | null>(null);

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
  const dayEvents = (iso: string) => (events ?? []).filter((e) => e.date === iso);
  const openDay = (d: Date) => { setAnchor(d); setView("day"); };

  const gridProps = {
    recipes, foods, dayMeals, dayEvents,
    onEmpty: (iso: string, hour: number) => setPicking({ iso, hour }),
    onRemoveMeal: removePlannedMeal,
    onRemoveEvent: removeEvent,
    onMoveMeal: (id: string, date: string, start: number, end: number) => updatePlannedMeal(id, { date, start, end }),
    onMoveEvent: (id: string, date: string, start: number, end: number) => updateEvent(id, { date, start, end }),
  };

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

      {view === "day" && <TimeGrid days={[anchor]} {...gridProps} />}
      {view === "week" && <TimeGrid days={weekDays(anchor)} {...gridProps} />}
      {view === "month" && <MonthView anchor={anchor} recipes={recipes} events={events ?? []} dayMeals={dayMeals} onOpenDay={openDay} onAdd={(iso) => setPicking({ iso, hour: null })} />}
      {view === "year" && <YearView anchor={anchor} plan={plan} events={events ?? []} onOpenDay={openDay} onOpenMonth={(d) => { setAnchor(d); setView("month"); }} />}

      {picking && (
        <AddModal
          iso={picking.iso}
          hour={picking.hour}
          recipes={recipes}
          foods={foods}
          onClose={() => setPicking(null)}
          onPickMeal={(r) => {
            const base = { id: newId(), date: picking.iso, mealType: r.category, recipeId: r.id, servings: r.servings };
            addPlannedMeal(
              picking.hour != null
                ? { ...base, start: snapHour(picking.hour), end: snapHour(picking.hour) + 1 }
                : base,
            );
            setPicking(null);
          }}
          onAddEvent={(title) => {
            const start = picking.hour != null ? snapHour(picking.hour) : 12;
            addEvent({ id: newId(), date: picking.iso, title: title.trim() || "Event", start, end: start + 1 });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

// ---------- Shared time grid (Day + Week) ----------

interface GhostState { x: number; y: number; width: number; height: number; label: string; block: string }
interface DragData {
  kind: "meal" | "event";
  id: string; label: string; block: string; durH: number;
  startX: number; startY: number; grabDX: number; grabDY: number;
  width: number; height: number; moved: boolean;
}

function TimeGrid({
  days, recipes, foods, dayMeals, dayEvents, onEmpty, onRemoveMeal, onRemoveEvent, onMoveMeal, onMoveEvent,
}: {
  days: Date[];
  recipes: Recipe[];
  foods: Food[];
  dayMeals: (iso: string) => PlannedMeal[];
  dayEvents: (iso: string) => CalendarEvent[];
  onEmpty: (iso: string, hour: number) => void;
  onRemoveMeal: (id: string) => void;
  onRemoveEvent: (id: string) => void;
  onMoveMeal: (id: string, date: string, start: number, end: number) => void;
  onMoveEvent: (id: string, date: string, start: number, end: number) => void;
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

  // ----- drag-to-move -----
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<DragData | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  // Keep the latest days + callbacks reachable from the (once-attached) listeners.
  const commitRef = useRef<(d: DragData, x: number, y: number) => void>(() => {});
  useEffect(() => {
    commitRef.current = (d, clientX, clientY) => {
      let idx = 0;
      for (let i = 0; i < days.length; i++) {
        const r = colRefs.current[i]?.getBoundingClientRect();
        if (!r) continue;
        if (clientX >= r.left) idx = i;
        if (clientX >= r.left && clientX < r.right) { idx = i; break; }
      }
      const colEl = colRefs.current[idx];
      if (!colEl) return;
      const r = colEl.getBoundingClientRect();
      let hour = START_HOUR + (clientY - d.grabDY - r.top) / HOUR_PX;
      hour = snapHour(hour);
      hour = Math.max(START_HOUR, Math.min(END_HOUR - d.durH, hour));
      const iso = isoOf(days[idx]);
      if (d.kind === "meal") onMoveMeal(d.id, iso, hour, hour + d.durH);
      else onMoveEvent(d.id, iso, hour, hour + d.durH);
    };
  });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
        d.moved = true;
      }
      setGhost({ x: e.clientX - d.grabDX, y: e.clientY - d.grabDY, width: d.width, height: d.height, label: d.label, block: d.block });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setGhost(null);
      if (d && d.moved) commitRef.current(d, e.clientX, e.clientY);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  const beginDrag = (
    e: React.PointerEvent,
    d: { kind: "meal" | "event"; id: string; label: string; block: string; durH: number },
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      ...d,
      startX: e.clientX, startY: e.clientY,
      grabDX: e.clientX - rect.left, grabDY: e.clientY - rect.top,
      width: rect.width, height: rect.height, moved: false,
    };
    e.preventDefault();
    e.stopPropagation();
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
          {days.map((d, ci) => {
            const iso = isoOf(d);
            const meals = dayMeals(iso);
            const evs = dayEvents(iso);
            return (
              <div
                key={iso}
                ref={(el) => { colRefs.current[ci] = el; }}
                className="relative flex-1 border-l border-white/[0.05]"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const hour = START_HOUR + (e.clientY - rect.top) / HOUR_PX;
                  onEmpty(iso, Math.max(START_HOUR, Math.min(END_HOUR - 1, hour)));
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

                {/* Free-form events */}
                {evs.map((ev) => {
                  const top = (ev.start - START_HOUR) * HOUR_PX;
                  const height = Math.max(28, (ev.end - ev.start) * HOUR_PX);
                  const c = EVENT_COLOR;
                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => beginDrag(e, { kind: "event", id: ev.id, label: ev.title, block: c.block, durH: ev.end - ev.start })}
                      className={`group absolute inset-x-1 z-10 cursor-grab touch-none select-none overflow-hidden rounded-md px-1.5 py-1 text-[11px] shadow-md active:cursor-grabbing ${c.block}`}
                      style={{ top, height }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="truncate font-semibold leading-tight">{ev.title}</span>
                        <button onClick={() => onRemoveEvent(ev.id)} onPointerDown={(e) => e.stopPropagation()} className="shrink-0 opacity-0 transition group-hover:opacity-100" aria-label="Remove">
                          <X size={11} />
                        </button>
                      </div>
                      <div className="truncate opacity-80">{clockLabel(ev.start)} – {clockLabel(ev.end)}</div>
                    </div>
                  );
                })}

                {/* Meal events */}
                {meals.map((m) => {
                  const r = recipes.find((x) => x.id === m.recipeId);
                  if (!r) return null;
                  const start = mealStart(m);
                  const end = mealEnd(m);
                  const top = (start - START_HOUR) * HOUR_PX;
                  const height = Math.max(28, (end - start) * HOUR_PX);
                  const cal = recipeTotalsPerServing(r, foods).calories * m.servings;
                  const c = MEAL_COLOR[m.mealType];
                  return (
                    <div
                      key={m.id}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => beginDrag(e, { kind: "meal", id: m.id, label: `${r.emoji} ${r.name}`, block: c.block, durH: end - start })}
                      className={`group absolute inset-x-1 z-10 cursor-grab touch-none select-none overflow-hidden rounded-md px-1.5 py-1 text-[11px] shadow-md active:cursor-grabbing ${c.block}`}
                      style={{ top, height }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className="truncate font-semibold leading-tight">{r.emoji} {r.name}</span>
                        <button onClick={() => onRemoveMeal(m.id)} onPointerDown={(e) => e.stopPropagation()} className="shrink-0 opacity-0 transition group-hover:opacity-100" aria-label="Remove">
                          <X size={11} />
                        </button>
                      </div>
                      <div className="truncate opacity-80">{clockLabel(start)} · {cal} cal</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t border-white/[0.07] px-4 py-2 text-center text-[11px] text-zinc-500">
        Tap an empty slot to add a meal or event · drag to move · hover to remove
      </div>

      {/* Drag ghost */}
      {ghost && (
        <div
          className={`pointer-events-none fixed z-50 overflow-hidden rounded-md px-1.5 py-1 text-[11px] font-semibold shadow-2xl ring-2 ring-white/40 ${ghost.block}`}
          style={{ left: ghost.x, top: ghost.y, width: ghost.width, height: ghost.height }}
        >
          <span className="truncate">{ghost.label}</span>
        </div>
      )}
    </div>
  );
}

// ---------- Month view ----------

function MonthView({
  anchor, recipes, events, dayMeals, onOpenDay, onAdd,
}: {
  anchor: Date;
  recipes: Recipe[];
  events: CalendarEvent[];
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
          const evs = events.filter((e) => e.date === iso);
          const items = meals.length + evs.length;
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
                <button onClick={() => onAdd(iso)} className="text-zinc-600 opacity-0 transition hover:text-emerald-400 group-hover:opacity-100" aria-label="Add">
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
                {meals.length < 3 && evs.slice(0, 3 - meals.length).map((ev) => (
                  <button key={ev.id} onClick={() => onOpenDay(d)} className="flex w-full items-center gap-1 truncate rounded bg-zinc-500/20 px-1 py-0.5 text-left text-[10px] font-medium text-zinc-200">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                    <span className="truncate">{ev.title}</span>
                  </button>
                ))}
                {items > 3 && (
                  <button onClick={() => onOpenDay(d)} className="px-1 text-[10px] text-zinc-500 hover:text-zinc-300">
                    +{items - 3} more
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
  anchor, plan, events, onOpenDay, onOpenMonth,
}: {
  anchor: Date;
  plan: PlannedMeal[];
  events: CalendarEvent[];
  onOpenDay: (d: Date) => void;
  onOpenMonth: (d: Date) => void;
}) {
  const year = anchor.getFullYear();
  const plannedDates = new Set<string>([...plan.map((m) => m.date), ...events.map((e) => e.date)]);
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

// ---------- Add-to-calendar modal (meal or event) ----------

function AddModal({
  iso, hour, recipes, foods, onClose, onPickMeal, onAddEvent,
}: {
  iso: string;
  hour: number | null;
  recipes: Recipe[];
  foods: Food[];
  onClose: () => void;
  onPickMeal: (r: Recipe) => void;
  onAddEvent: (title: string) => void;
}) {
  const [tab, setTab] = useState<"meal" | "event">("meal");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<MealType | "">("");
  const [eventTitle, setEventTitle] = useState("");

  const q = query.trim().toLowerCase();
  const matches = q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : [];
  const when = hour != null ? ` · ${clockLabel(snapHour(hour))}` : "";

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="max-h-[82vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-zinc-950/95 p-5 md:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Add · {format(new Date(iso), "EEE, MMM d")}{when}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200"><X size={20} /></button>
        </div>

        {/* Meal / Event tabs */}
        <div className="mb-4 flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5 text-sm">
          <button onClick={() => setTab("meal")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${tab === "meal" ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-100"}`}>
            <UtensilsCrossed size={15} /> Meal
          </button>
          <button onClick={() => setTab("event")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${tab === "event" ? "bg-gradient-to-b from-emerald-500 to-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-100"}`}>
            <CalendarPlus size={15} /> Event
          </button>
        </div>

        {tab === "meal" ? (
          <>
            {/* Search across every recipe — any meal can land in any slot. */}
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes…"
                className="w-full rounded-lg field py-2 pl-9 pr-3 text-sm"
              />
            </div>

            {q ? (
              <div className="space-y-1">
                {matches.length === 0 && <p className="px-2 py-6 text-center text-xs text-zinc-500">No recipes match “{query}”.</p>}
                {matches.map((r) => {
                  const cal = recipeTotalsPerServing(r, foods).calories;
                  const c = MEAL_COLOR[r.category];
                  return (
                    <button key={r.id} onClick={() => onPickMeal(r)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-emerald-500/10">
                      <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${c.dot}`} />{r.emoji} {r.name}</span>
                      <span className="text-xs text-zinc-400">{MEAL_LABEL[r.category]} · {cal} cal</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {MEAL_ORDER.map((mt) => {
                  const list = recipes.filter((r) => r.category === mt);
                  const isOpen = open === mt;
                  const c = MEAL_COLOR[mt];
                  return (
                    <div key={mt} className="overflow-hidden rounded-xl border border-white/10">
                      <button
                        onClick={() => setOpen(isOpen ? "" : mt)}
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
                                onClick={() => onPickMeal(r)}
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
            )}
          </>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm text-zinc-400">Event name</label>
            <input
              autoFocus
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && eventTitle.trim()) onAddEvent(eventTitle); }}
              placeholder="e.g. Grocery run, Meal prep, Gym"
              className="w-full rounded-lg field px-3 py-2 text-sm"
            />
            <p className="text-xs text-zinc-500">
              Adds a 1-hour event {hour != null ? `at ${clockLabel(snapHour(hour))}` : "at noon"}. Drag it on the day or week grid to move it.
            </p>
            <button
              onClick={() => onAddEvent(eventTitle)}
              disabled={!eventTitle.trim()}
              className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-900/30 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add event
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
