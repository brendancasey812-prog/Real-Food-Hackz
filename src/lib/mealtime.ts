import type { MealType, PlannedMeal } from "./types";

/** Where meals sit on a clock, so Day/Week views can place them like calendar events. */
export const MEAL_TIME: Record<MealType, { start: number; end: number }> = {
  breakfast: { start: 8, end: 8.75 },
  lunch: { start: 12.5, end: 13.25 },
  snack: { start: 15.5, end: 16 },
  dinner: { start: 19, end: 20 },
  extra: { start: 21.5, end: 22 }
};

/** One calm color per meal slot — muted enough to sit in a dense calendar
 *  without shouting, distinct enough to scan. Defined as tokens so both
 *  themes get their own tuning (see globals.css). */
export const MEAL_COLOR: Record<
  MealType,
  { block: string; dot: string; soft: string }
> = {
  breakfast: { block: "bg-meal-breakfast text-on-accent", dot: "bg-meal-breakfast", soft: "bg-meal-breakfast/20 text-meal-breakfast-soft" },
  lunch: { block: "bg-meal-lunch text-on-accent", dot: "bg-meal-lunch", soft: "bg-meal-lunch/20 text-meal-lunch-soft" },
  snack: { block: "bg-meal-snack text-on-accent", dot: "bg-meal-snack", soft: "bg-meal-snack/20 text-meal-snack-soft" },
  dinner: { block: "bg-meal-dinner text-on-accent", dot: "bg-meal-dinner", soft: "bg-meal-dinner/20 text-meal-dinner-soft" },
  extra: { block: "bg-meal-extra text-on-accent", dot: "bg-meal-extra", soft: "bg-meal-extra/20 text-meal-extra-soft" }
};

/** Solid color for free-form (non-recipe) calendar events. */
export const EVENT_COLOR = { block: "bg-meal-event text-on-accent", dot: "bg-meal-event" };

/** Effective start/end (decimal hours) of a planned meal — a custom placement
 *  wins over the default meal-time slot. */
export const mealStart = (m: PlannedMeal) => m.start ?? MEAL_TIME[m.mealType].start;
export const mealEnd = (m: PlannedMeal) =>
  m.end ?? (m.start != null ? m.start + 1 : MEAL_TIME[m.mealType].end);

/** Snap a decimal hour to the nearest 30 minutes. */
export const snapHour = (h: number) => Math.round(h * 2) / 2;

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
