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
  getMinutes
} from "date-fns";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, X, CalendarDays, Search, CalendarPlus, UtensilsCrossed, Eraser } from "lucide-react";
import { useApp, recipeTotalsPerServing, newId } from "@/lib/store";
import { weekDays, isoOf, monthGrid, MEAL_ORDER, MEAL_LABEL } from "@/lib/week";
import {
  MEAL_COLOR, EVENT_COLOR, mealStart, mealEnd, snapHour,
  START_HOUR, END_HOUR, HOUR_PX, formatHour, clockLabel
} from "@/lib/mealtime";
import { MealDetailModal } from "@/components/MealDetailModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ClearMealsSheet } from "@/components/ClearMealsSheet";
import { SearchFilterBar } from "@/components/SearchFilterBar";
import type { MealType, PlannedMeal, CalendarEvent, Recipe, Food } from "@/lib/types";
import { SettingsButton } from "@/components/SettingsButton";

type View = "day" | "week" | "month" | "year";
const VIEWS: View[] = ["day", "week", "month", "year"];

export default function Planner() {
  const {
    recipes, foods, plan, events,
    addPlannedMeal, updatePlannedMeal, removePlannedMeal, clearMeals,
    addEvent, updateEvent, removeEvent, members, householdMode
  } = useApp();
  // Couple/family: one recipe should feed everyone, so default the servings.
  const householdSize = householdMode === "individual" ? 1 : 1 + (members?.length ?? 0);
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [picking, setPicking] = useState<{ iso: string; hour: number | null; durH: number } | null>(null);
  const [openMealId, setOpenMealId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ kind: "meal" | "event"; id: string; name: string } | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState<
    { dates: string[]; count: number; scope: string } | null
  >(null);
  const [search, setSearch] = useState("");
  const [mealFilter, setMealFilter] = useState("all");
  const q = search.trim().toLowerCase();

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

  const moveItem = (kind: "meal" | "event", id: string, date: string, start: number, end: number) => {
    if (kind === "meal") updatePlannedMeal(id, { date, start, end });
    else updateEvent(id, { date, start, end });
  };

  const gridProps = {
    recipes, foods, dayMeals, dayEvents, query: q, mealFilter,
    onEmpty: (iso: string, hour: number, durH: number) => setPicking({ iso, hour, durH }),
    onOpenMeal: (id: string) => setOpenMealId(id),
    onRemoveMeal: (id: string) => {
      const m = plan.find((x) => x.id === id);
      const r = recipes.find((x) => x.id === m?.recipeId);
      setConfirmRemove({ kind: "meal", id, name: r?.name ?? "this meal" });
    },
    onRemoveEvent: (id: string) => {
      const e = (events ?? []).find((x) => x.id === id);
      setConfirmRemove({ kind: "event", id, name: e?.title ?? "this event" });
    },
    onMoveItem: moveItem
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Google-Calendar-style header */}
      <header className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-deep text-on-accent shadow-lg">
            <CalendarDays size={18} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Meal Plan</h1>
        </div>

        <button
          onClick={() => setAnchor(new Date())}
          className="rounded-lg border border-line bg-surface px-3.5 py-1.5 text-sm font-medium hover:bg-surface-3"
        >
          Today
        </button>

        <div className="flex items-center gap-0.5">
          <button onClick={() => shift(-1)} aria-label="Previous" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-ink">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => shift(1)} aria-label="Next" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-3 hover:text-ink">
            <ChevronRight size={20} />
          </button>
        </div>

        <h2 className="min-w-0 flex-1 truncate text-base font-medium text-ink md:text-lg">{title}</h2>

        {/* View switcher (top right) — works on phone & web */}
        <div className="ml-auto flex shrink-0 rounded-lg border border-line bg-surface p-0.5 text-xs md:text-sm">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1.5 font-medium capitalize transition-colors md:px-3.5 ${
                view === v
                  ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent shadow"
                  : "text-muted hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Clear meals — day, week, month, year, chosen days, or a range */}
        <button
          onClick={() => setClearOpen(true)}
          aria-label="Clear meals"
          title="Clear meals"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-surface-3"
        >
          <Eraser size={15} /> Clear
        </button>

        <SettingsButton className="hidden md:flex" />
      </header>

      <SearchFilterBar
        query={search}
        onQuery={setSearch}
        placeholder="Search meals & events…"
        value={mealFilter}
        onValue={setMealFilter}
        options={[
          { value: "all", label: "All items" },
          ...MEAL_ORDER.map((m) => ({ value: m, label: MEAL_LABEL[m] })),
          { value: "event", label: "Events" },
        ]}
      />

      {view === "day" && <TimeGrid days={[anchor]} {...gridProps} />}
      {view === "week" && <TimeGrid days={weekDays(anchor)} {...gridProps} />}
      {view === "month" && <MonthView anchor={anchor} recipes={recipes} events={events ?? []} dayMeals={dayMeals} query={q} mealFilter={mealFilter} onOpenDay={openDay} onAdd={(iso) => setPicking({ iso, hour: null, durH: 1 })} />}
      {view === "year" && <YearView anchor={anchor} plan={plan} events={events ?? []} onOpenDay={openDay} onOpenMonth={(d) => { setAnchor(d); setView("month"); }} />}

      {picking && (
        <AddModal
          iso={picking.iso}
          hour={picking.hour}
          durH={picking.durH}
          recipes={recipes}
          foods={foods}
          onClose={() => setPicking(null)}
          onPickMeal={(r) => {
            const base = { id: newId(), date: picking.iso, mealType: r.category, recipeId: r.id, servings: Math.max(householdSize, 1) };
            addPlannedMeal(
              picking.hour != null
                ? { ...base, start: snapHour(picking.hour), end: snapHour(picking.hour) + picking.durH }
                : base,
            );
            setPicking(null);
          }}
          onAddEvent={(title) => {
            const start = picking.hour != null ? snapHour(picking.hour) : 12;
            addEvent({ id: newId(), date: picking.iso, title: title.trim() || "Event", start, end: start + picking.durH });
            setPicking(null);
          }}
        />
      )}

      {openMealId && <MealDetailModal mealId={openMealId} onClose={() => setOpenMealId(null)} />}

      {clearOpen && (
        <ClearMealsSheet
          anchor={anchor}
          plan={plan}
          onClose={() => setClearOpen(false)}
          onChoose={(dates, scope, count) => {
            setClearOpen(false);
            setConfirmClear({ dates, scope, count });
          }}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title={`Clear ${confirmClear.count} ${confirmClear.count === 1 ? "meal" : "meals"}?`}
          message={`Every meal planned for ${confirmClear.scope} will be removed. Calendar events are left alone. This can’t be undone.`}
          confirmLabel={`Clear ${confirmClear.count === 1 ? "meal" : "meals"}`}
          onConfirm={() => {
            clearMeals(confirmClear.dates);
            setConfirmClear(null);
          }}
          onCancel={() => setConfirmClear(null)}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          title={confirmRemove.kind === "meal" ? "Remove meal?" : "Remove event?"}
          message={`“${confirmRemove.name}” will be removed from this day. ${confirmRemove.kind === "meal" ? "The recipe stays in your cookbook." : ""}`.trim()}
          confirmLabel="Remove"
          onConfirm={() => {
            if (confirmRemove.kind === "meal") removePlannedMeal(confirmRemove.id);
            else removeEvent(confirmRemove.id);
            setConfirmRemove(null);
          }}
          onCancel={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

// ---------- Shared time grid (Day + Week) — Google-Calendar-style ----------

type ItemKind = "meal" | "event";
type Mode = "move" | "resize" | "create";
interface Gesture {
  mode: Mode;
  kind?: ItemKind;
  id?: string;
  durH: number;      // move: fixed duration
  grab: number;      // move: hours between pointer and item top
  dayIndex: number;
  startHour: number;
  endHour: number;
  block: string;     // preview color
  label: string;
  px: number; py: number; moved: boolean; mouse: boolean;
}
interface Preview {
  mode: Mode; id?: string; dayIndex: number; startHour: number; endHour: number; block: string; label: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// One positioned block on a day column.
interface Block {
  key: string; kind: ItemKind; id: string;
  start: number; end: number; block: string; title: string; sub: string;
  onRemove: () => void;
  dimmed: boolean; // faded because it doesn't match the active search/filter
  left: number; width: number; // fractions [0,1], filled by layoutOverlaps
}

// Google-Calendar-style overlap layout: transitively-overlapping blocks are
// split into side-by-side columns so none stacks on top of (and blocks) another.
function layoutOverlaps(items: Block[]): Block[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Block[] = [];
  let cluster: Block[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const colEnds: number[] = [];
    const colOf = new Map<Block, number>();
    for (const it of cluster) {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (it.start >= colEnds[c] - 1e-9) { colOf.set(it, c); colEnds[c] = it.end; placed = true; break; }
      }
      if (!placed) { colOf.set(it, colEnds.length); colEnds.push(it.end); }
    }
    const n = colEnds.length || 1;
    for (const it of cluster) { it.left = (colOf.get(it) ?? 0) / n; it.width = 1 / n; out.push(it); }
  };
  for (const it of sorted) {
    if (cluster.length && it.start >= clusterEnd - 1e-9) { flush(); cluster = []; clusterEnd = -Infinity; }
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length) flush();
  return out;
}

function TimeGrid({
  days, recipes, foods, dayMeals, dayEvents, query, mealFilter, onEmpty, onOpenMeal, onRemoveMeal, onRemoveEvent, onMoveItem
}: {
  days: Date[];
  recipes: Recipe[];
  foods: Food[];
  dayMeals: (iso: string) => PlannedMeal[];
  dayEvents: (iso: string) => CalendarEvent[];
  query: string;
  mealFilter: string;
  onEmpty: (iso: string, hour: number, durH: number) => void;
  onOpenMeal: (id: string) => void;
  onRemoveMeal: (id: string) => void;
  onRemoveEvent: (id: string) => void;
  onMoveItem: (kind: ItemKind, id: string, date: string, start: number, end: number) => void;
}) {
  const filterOn = query !== "" || mealFilter !== "all";
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

  // ----- unified pointer gesture (move / resize / create) -----
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gestureRef = useRef<Gesture | null>(null);
  const skipClickRef = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  // Swallow the click a browser fires right after a pointer gesture ends.
  const suppressClick = () => {
    skipClickRef.current = true;
    window.setTimeout(() => { skipClickRef.current = false; }, 60);
  };

  const locate = (clientX: number, clientY: number) => {
    let idx = 0;
    for (let i = 0; i < days.length; i++) {
      const r = colRefs.current[i]?.getBoundingClientRect();
      if (!r) continue;
      if (clientX >= r.left) idx = i;
      if (clientX >= r.left && clientX < r.right) { idx = i; break; }
    }
    const r = colRefs.current[idx]?.getBoundingClientRect();
    const hour = r ? START_HOUR + (clientY - r.top) / HOUR_PX : START_HOUR;
    return { idx, hour };
  };

  // Keep move/up logic fresh (they run from once-attached window listeners).
  const moveRef = useRef<(e: PointerEvent) => void>(() => {});
  const upRef = useRef<(e: PointerEvent) => void>(() => {});
  useEffect(() => {
    moveRef.current = (e) => {
      const g = gestureRef.current;
      if (!g) return;
      if (!g.moved) {
        if (Math.hypot(e.clientX - g.px, e.clientY - g.py) < 4) return;
        g.moved = true;
      }
      const { idx, hour } = locate(e.clientX, e.clientY);
      if (g.mode === "move") {
        g.dayIndex = idx;
        g.startHour = clamp(snapHour(hour - g.grab), START_HOUR, END_HOUR - g.durH);
        g.endHour = g.startHour + g.durH;
      } else if (g.mode === "resize") {
        g.endHour = clamp(snapHour(hour), g.startHour + 0.5, END_HOUR);
      } else {
        g.endHour = clamp(snapHour(hour), START_HOUR, END_HOUR);
      }
      setPreview({ mode: g.mode, id: g.id, dayIndex: g.dayIndex, startHour: Math.min(g.startHour, g.endHour), endHour: Math.max(g.startHour, g.endHour), block: g.block, label: g.label });
    };
    upRef.current = () => {
      const g = gestureRef.current;
      gestureRef.current = null;
      setPreview(null);
      if (!g) return;
      // Any completed gesture swallows the trailing browser-synthesized click
      // (a pointerup over the column would otherwise re-open the Add dialog).
      if (g.mode === "create" || g.moved) suppressClick();
      if (g.mode === "create") {
        const iso = isoOf(days[g.dayIndex]);
        if (!g.moved) { onEmpty(iso, g.startHour, 1); return; }
        let s = g.startHour, en = g.endHour;
        if (en < s) [s, en] = [en, s];
        if (en - s < 0.5) en = s + 0.5;
        onEmpty(iso, s, Math.round((en - s) * 4) / 4);
        return;
      }
      if (!g.moved || !g.kind || !g.id) return;
      const iso = isoOf(days[g.dayIndex]);
      if (g.mode === "move") onMoveItem(g.kind, g.id, iso, g.startHour, g.startHour + g.durH);
      else onMoveItem(g.kind, g.id, iso, g.startHour, g.endHour);
    };
  });

  useEffect(() => {
    const m = (e: PointerEvent) => moveRef.current(e);
    const u = (e: PointerEvent) => upRef.current(e);
    window.addEventListener("pointermove", m);
    window.addEventListener("pointerup", u);
    return () => { window.removeEventListener("pointermove", m); window.removeEventListener("pointerup", u); };
  }, []);

  const startMove = (e: React.PointerEvent, kind: ItemKind, id: string, start: number, end: number, block: string, label: string) => {
    e.preventDefault();
    e.stopPropagation();
    const { idx, hour } = locate(e.clientX, e.clientY);
    gestureRef.current = {
      mode: "move", kind, id, durH: end - start, grab: hour - start,
      dayIndex: idx, startHour: start, endHour: end, block, label,
      px: e.clientX, py: e.clientY, moved: false, mouse: e.pointerType === "mouse"
    };
  };
  const startResize = (e: React.PointerEvent, kind: ItemKind, id: string, start: number, end: number, block: string, label: string) => {
    e.preventDefault();
    e.stopPropagation();
    const { idx } = locate(e.clientX, e.clientY);
    gestureRef.current = {
      mode: "resize", kind, id, durH: end - start, grab: 0,
      dayIndex: idx, startHour: start, endHour: end, block, label,
      px: e.clientX, py: e.clientY, moved: false, mouse: e.pointerType === "mouse"
    };
  };
  const startCreate = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return; // touch taps still open the modal via onClick
    const { idx, hour } = locate(e.clientX, e.clientY);
    const s = snapHour(hour);
    gestureRef.current = {
      mode: "create", durH: 1, grab: 0, dayIndex: idx, startHour: s, endHour: s + 0.5,
      block: "bg-accent text-on-accent", label: "New",
      px: e.clientX, py: e.clientY, moved: false, mouse: true
    };
    e.preventDefault();
  };

  return (
    <div className="overflow-hidden rounded-2xl card">
      {/* Day headers */}
      <div className="flex border-b border-line" style={{ paddingRight: 8 }}>
        <div className="w-14 shrink-0 md:w-16" />
        {days.map((d) => (
          <div key={isoOf(d)} className="flex flex-1 flex-col items-center gap-0.5 border-l border-line py-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{format(d, "EEE")}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isToday(d) ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent" : "text-ink"}`}>
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
                <span className="absolute -top-2 right-2 text-[10px] text-muted">{formatHour(h)}</span>
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
                className="relative flex-1 touch-pan-y border-l border-line"
                onPointerDown={startCreate}
                onClick={(e) => {
                  if (skipClickRef.current) { skipClickRef.current = false; return; }
                  const rect = e.currentTarget.getBoundingClientRect();
                  const hour = START_HOUR + (e.clientY - rect.top) / HOUR_PX;
                  onEmpty(iso, clamp(hour, START_HOUR, END_HOUR - 1), 1);
                }}
              >
                {/* Hour lines */}
                {hours.slice(0, -1).map((h) => (
                  <div key={h} className="border-b border-line" style={{ height: HOUR_PX }} />
                ))}

                {/* Now indicator */}
                {nowVisible && isToday(d) && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (nowH - START_HOUR) * HOUR_PX }}>
                    <div className="relative h-0 border-t-2 border-danger">
                      <span className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-danger" />
                    </div>
                  </div>
                )}

                {/* Events + meals, laid out side-by-side where they overlap */}
                {layoutOverlaps([
                  ...evs.map((ev): Block => {
                    const matches = (query ? ev.title.toLowerCase().includes(query) : true) && (mealFilter === "all" || mealFilter === "event");
                    return {
                      key: ev.id, kind: "event", id: ev.id, start: ev.start, end: ev.end,
                      block: EVENT_COLOR.block, title: ev.title, sub: `${clockLabel(ev.start)} – ${clockLabel(ev.end)}`,
                      onRemove: () => onRemoveEvent(ev.id), dimmed: filterOn && !matches, left: 0, width: 1
                    };
                  }),
                  ...meals.map((m): Block | null => {
                    const r = recipes.find((x) => x.id === m.recipeId);
                    if (!r) return null;
                    const start = mealStart(m), end = mealEnd(m);
                    const cal = recipeTotalsPerServing(r, foods, recipes).calories * m.servings;
                    const matches = (query ? r.name.toLowerCase().includes(query) : true) && (mealFilter === "all" || m.mealType === mealFilter);
                    return {
                      key: m.id, kind: "meal", id: m.id, start, end,
                      block: MEAL_COLOR[m.mealType].block, title: r.name, sub: `${clockLabel(start)} · ${cal} cal`,
                      onRemove: () => onRemoveMeal(m.id), dimmed: filterOn && !matches, left: 0, width: 1
                    };
                  }).filter((b): b is Block => b !== null),
                ]).map((b) => {
                  const top = (b.start - START_HOUR) * HOUR_PX;
                  const height = Math.max(24, (b.end - b.start) * HOUR_PX);
                  return (
                    <EventBlock
                      key={b.key} top={top} height={height} leftPct={b.left} widthPct={b.width}
                      block={b.block} dim={preview?.id === b.id || b.dimmed} title={b.title} sub={b.sub}
                      onRemove={b.onRemove}
                      onOpen={b.kind === "meal" ? () => { if (!skipClickRef.current) onOpenMeal(b.id); } : undefined}
                      onMoveDown={(e) => startMove(e, b.kind, b.id, b.start, b.end, b.block, b.title)}
                      onResizeDown={(e) => startResize(e, b.kind, b.id, b.start, b.end, b.block, b.title)}
                    />
                  );
                })}

                {/* Live drag / create preview */}
                {preview && preview.dayIndex === ci && (
                  <div
                    className={`pointer-events-none absolute inset-x-1 z-30 overflow-hidden rounded-md px-1.5 py-1 text-[11px] font-semibold shadow-2xl ring-2 ring-line-2 ${preview.block}`}
                    style={{ top: (preview.startHour - START_HOUR) * HOUR_PX, height: Math.max(20, (preview.endHour - preview.startHour) * HOUR_PX) }}
                  >
                    <div className="truncate">{preview.mode === "create" ? "New" : preview.label}</div>
                    <div className="truncate opacity-90">{clockLabel(preview.startHour)} – {clockLabel(preview.endHour)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t border-line px-4 py-2 text-center text-[11px] text-muted">
        Click a meal to see its ingredients · drag to move · drag the bottom edge to resize · drag empty space to add
      </div>
    </div>
  );
}

// A single draggable/resizable calendar block.
function EventBlock({
  top, height, leftPct, widthPct, block, dim, title, sub, onRemove, onOpen, onMoveDown, onResizeDown
}: {
  top: number; height: number; leftPct: number; widthPct: number; block: string; dim: boolean;
  title: string; sub: string;
  onRemove: () => void;
  onOpen?: () => void;
  onMoveDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onOpen?.(); }}
      onPointerDown={onMoveDown}
      className={`group absolute z-10 touch-none select-none overflow-hidden rounded-md px-1.5 py-1 text-[11px] shadow-md transition-opacity active:cursor-grabbing ${onOpen ? "cursor-pointer" : "cursor-grab"} ${block} ${dim ? "opacity-30" : ""}`}
      style={{ top, height, left: `calc(${leftPct * 100}% + 1px)`, width: `calc(${widthPct * 100}% - 2px)` }}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="truncate font-semibold leading-tight">{title}</span>
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} onPointerDown={(e) => e.stopPropagation()} className="shrink-0 opacity-0 transition group-hover:opacity-100" aria-label="Remove">
          <X size={11} />
        </button>
      </div>
      <div className="truncate opacity-80">{sub}</div>
      {/* Resize handle */}
      <div
        onPointerDown={onResizeDown}
        className="absolute inset-x-0 bottom-0 z-20 h-2 cursor-ns-resize"
      >
        <div className="mx-auto mb-0.5 h-0.5 w-6 rounded-full bg-line-2 opacity-0 transition group-hover:opacity-100" />
      </div>
    </div>
  );
}

// ---------- Month view ----------

function MonthView({
  anchor, recipes, events, dayMeals, query, mealFilter, onOpenDay, onAdd
}: {
  anchor: Date;
  recipes: Recipe[];
  events: CalendarEvent[];
  dayMeals: (iso: string) => PlannedMeal[];
  query: string;
  mealFilter: string;
  onOpenDay: (d: Date) => void;
  onAdd: (iso: string) => void;
}) {
  const weeks = monthGrid(anchor);
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const mealMatches = (m: PlannedMeal) => {
    const r = recipes.find((x) => x.id === m.recipeId);
    return (query ? !!r && r.name.toLowerCase().includes(query) : true) && (mealFilter === "all" || m.mealType === mealFilter);
  };
  const eventMatches = (e: CalendarEvent) =>
    (query ? e.title.toLowerCase().includes(query) : true) && (mealFilter === "all" || mealFilter === "event");
  return (
    <div className="overflow-hidden rounded-2xl card">
      <div className="grid grid-cols-7 border-b border-line">
        {dow.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((d, i) => {
          const iso = isoOf(d);
          const inMonth = isSameMonth(d, anchor);
          const meals = dayMeals(iso).filter(mealMatches);
          const evs = events.filter((e) => e.date === iso).filter(eventMatches);
          const items = meals.length + evs.length;
          return (
            <div
              key={iso}
              className={`group min-h-[92px] border-b border-r border-line p-1.5 ${i % 7 === 6 ? "border-r-0" : ""} ${inMonth ? "" : "bg-sunken"}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  onClick={() => onOpenDay(d)}
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium ${
                    isToday(d) ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent" : inMonth ? "text-ink-2 hover:bg-surface-3" : "text-faint"
                  }`}
                >
                  {format(d, "d")}
                </button>
                <button onClick={() => onAdd(iso)} className="text-faint opacity-0 transition hover:text-accent-soft group-hover:opacity-100" aria-label="Add">
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
                      <span className="truncate">{r.name}</span>
                    </button>
                  );
                })}
                {meals.length < 3 && evs.slice(0, 3 - meals.length).map((ev) => (
                  <button key={ev.id} onClick={() => onOpenDay(d)} className="flex w-full items-center gap-1 truncate rounded bg-surface-3 px-1 py-0.5 text-left text-[10px] font-medium text-ink">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-track" />
                    <span className="truncate">{ev.title}</span>
                  </button>
                ))}
                {items > 3 && (
                  <button onClick={() => onOpenDay(d)} className="px-1 text-[10px] text-muted hover:text-ink-2">
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
  anchor, plan, events, onOpenDay, onOpenMonth
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
            <button onClick={() => onOpenMonth(monthDate)} className="mb-2 px-1 text-sm font-semibold text-accent-soft hover:text-accent-soft">
              {format(monthDate, "MMMM")}
            </button>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {dow.map((d, i) => (
                <span key={i} className="text-[9px] font-medium text-faint">{d}</span>
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
                        ? "bg-gradient-to-b from-accent to-accent-deep font-semibold text-on-accent"
                        : inMonth ? "text-ink-2 hover:bg-surface-3" : "text-faint"
                    }`}
                  >
                    {format(d, "d")}
                    {has && !isToday(d) && inMonth && (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-accent" />
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
  iso, hour, durH, recipes, foods, onClose, onPickMeal, onAddEvent
}: {
  iso: string;
  hour: number | null;
  durH: number;
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
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-scrim p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="max-h-[82vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-page p-5 md:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Add · {format(new Date(iso), "EEE, MMM d")}{when}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={20} /></button>
        </div>

        {/* Meal / Event tabs */}
        <div className="mb-4 flex rounded-xl border border-line bg-surface p-0.5 text-sm">
          <button onClick={() => setTab("meal")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${tab === "meal" ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent" : "text-muted hover:text-ink"}`}>
            <UtensilsCrossed size={15} /> Meal
          </button>
          <button onClick={() => setTab("event")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 font-medium ${tab === "event" ? "bg-gradient-to-b from-accent to-accent-deep text-on-accent" : "text-muted hover:text-ink"}`}>
            <CalendarPlus size={15} /> Event
          </button>
        </div>

        {tab === "meal" ? (
          <>
            {/* Search across every recipe — any meal can land in any slot. */}
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
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
                {matches.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">No recipes match “{query}”.</p>}
                {matches.map((r) => {
                  const cal = recipeTotalsPerServing(r, foods, recipes).calories;
                  const c = MEAL_COLOR[r.category];
                  return (
                    <button key={r.id} onClick={() => onPickMeal(r)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent-wash">
                      <span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${c.dot}`} />{r.name}</span>
                      <span className="text-xs text-muted">{MEAL_LABEL[r.category]} · {cal} cal</span>
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
                    <div key={mt} className="overflow-hidden rounded-xl border border-line">
                      <button
                        onClick={() => setOpen(isOpen ? "" : mt)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-surface-3"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
                          {MEAL_LABEL[mt]}
                          <span className="text-xs font-normal text-muted">{list.length}</span>
                        </span>
                        <ChevronDown size={16} className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="space-y-1 border-t border-line p-2">
                          {list.length === 0 && (
                            <p className="px-2 py-3 text-center text-xs text-muted">No recipes in this section yet.</p>
                          )}
                          {list.map((r) => {
                            const cal = recipeTotalsPerServing(r, foods, recipes).calories;
                            return (
                              <button
                                key={r.id}
                                onClick={() => onPickMeal(r)}
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-accent-wash"
                              >
                                <span>{r.name}</span>
                                <span className="text-xs text-muted">{cal} cal</span>
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
            <label className="block text-sm text-muted">Event name</label>
            <input
              autoFocus
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && eventTitle.trim()) onAddEvent(eventTitle); }}
              placeholder="e.g. Grocery run, Meal prep, Gym"
              className="w-full rounded-lg field px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted">
              Adds a {durH === 1 ? "1-hour" : `${durH}-hour`} event {hour != null ? `at ${clockLabel(snapHour(hour))}` : "at noon"}. Drag it on the day or week grid to move or resize it.
            </p>
            <button
              onClick={() => onAddEvent(eventTitle)}
              disabled={!eventTitle.trim()}
              className="w-full rounded-xl bg-gradient-to-b from-accent to-accent-deep py-2.5 text-sm font-medium text-on-accent shadow-lg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add event
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
