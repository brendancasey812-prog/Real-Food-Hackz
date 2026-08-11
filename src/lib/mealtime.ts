import type { MealType, PlannedMeal } from "./types";

/** Where meals sit on a clock, so Day/Week views can place them like calendar events. */
export const MEAL_TIME: Record<MealType, { start: number; end: number }> = {
  breakfast: { start: 8, end: 8.75 },
  lunch: { start: 12.5, end: 13.25 },
  snack: { start: 15.5, end: 16 },
  dinner: { start: 19, end: 20 },
  extra: { start: 21.5, end: 22 },
};

/** Google-Calendar-style solid event colors, one per meal type. */
export const MEAL_COLOR: Record<
  MealType,
  { block: string; dot: string; soft: string }
> = {
  breakfast: { block: "bg-amber-500 text-amber-950", dot: "bg-amber-400", soft: "bg-amber-500/20 text-amber-200" },
  lunch: { block: "bg-sky-600 text-white", dot: "bg-sky-400", soft: "bg-sky-600/25 text-sky-200" },
  snack: { block: "bg-emerald-600 text-white", dot: "bg-emerald-400", soft: "bg-emerald-600/25 text-emerald-200" },
  dinner: { block: "bg-indigo-600 text-white", dot: "bg-indigo-400", soft: "bg-indigo-600/25 text-indigo-200" },
  extra: { block: "bg-fuchsia-600 text-white", dot: "bg-fuchsia-400", soft: "bg-fuchsia-600/25 text-fuchsia-200" },
};

/** Solid color for free-form (non-recipe) calendar events. */
export const EVENT_COLOR = { block: "bg-zinc-500 text-white", dot: "bg-zinc-300" };

/** Effective start/end (decimal hours) of a planned meal — a custom placement
 *  wins over the default meal-time slot. */
export const mealStart = (m: PlannedMeal) => m.start ?? MEAL_TIME[m.mealType].start;
export const mealEnd = (m: PlannedMeal) =>
  m.end ?? (m.start != null ? m.start + 1 : MEAL_TIME[m.mealType].end);

/** Snap a decimal hour to the nearest 15 minutes. */
export const snapHour = (h: number) => Math.round(h * 4) / 4;

/** The hour window the Day/Week grids render (6 AM → midnight). */
export const START_HOUR = 6;
export const END_HOUR = 24;
export const HOUR_PX = 48;

export function formatHour(h: number): string {
  const hr = h % 24;
  if (hr === 0) return "12 AM";
  if (hr === 12) return "12 PM";
  return hr < 12 ? `${hr} AM` : `${hr - 12} PM`;
}

/** "8:00 AM", "12:30 PM" from a decimal hour. */
export function clockLabel(h: number): string {
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  const ampm = hr < 12 || hr === 24 ? "AM" : "PM";
  const disp = hr % 12 === 0 ? 12 : hr % 12;
  return `${disp}:${min.toString().padStart(2, "0")} ${ampm}`;
}
