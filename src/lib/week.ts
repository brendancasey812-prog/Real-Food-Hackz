import { startOfWeek, addDays, format } from "date-fns";

export const ISO = "yyyy-MM-dd";

/** The 7 dates (Mon–Sun) of the week containing `ref`. */
export function weekDays(ref: Date): Date[] {
  const start = startOfWeek(ref, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isoOf(d: Date) {
  return format(d, ISO);
}

export const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;

export const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};
