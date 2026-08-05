import {
  startOfWeek,
  addDays,
  format,
  startOfMonth,
  endOfMonth,
  getDay,
} from "date-fns";

export const ISO = "yyyy-MM-dd";

/** The 7 dates (Mon–Sun) of the week containing `ref`. */
export function weekDays(ref: Date): Date[] {
  const start = startOfWeek(ref, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isoOf(d: Date) {
  return format(d, ISO);
}

/** Monday = 0 … Sunday = 6 (date-fns getDay is Sunday = 0). */
export function mondayIndex(d: Date): number {
  return (getDay(d) + 6) % 7;
}

/** Every calendar date in the month containing `ref`. */
export function monthDays(ref: Date): Date[] {
  const start = startOfMonth(ref);
  const end = endOfMonth(ref);
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

/**
 * The calendar grid (weeks × 7) that fully contains the month, padded with
 * leading/trailing days so every row has 7 cells — like Google Calendar.
 */
export function monthGrid(ref: Date): Date[][] {
  const gridStart = startOfWeek(startOfMonth(ref), { weekStartsOn: 1 });
  const gridEnd = startOfWeek(addDays(endOfMonth(ref), 6), { weekStartsOn: 1 });
  const weeks: Date[][] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  }
  return weeks;
}

export const MEAL_ORDER = ["breakfast", "lunch", "snack", "dinner", "extra"] as const;

export const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
  extra: "Extra",
};
