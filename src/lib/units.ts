import type { Unit } from "./types";

/** All selectable US cooking units, with a sensible +/- step for each. */
export const UNITS: { value: Unit; label: string; step: number }[] = [
  { value: "each", label: "each", step: 1 },
  { value: "cup", label: "cup", step: 0.25 },
  { value: "tbsp", label: "tbsp", step: 1 },
  { value: "tsp", label: "tsp", step: 1 },
  { value: "oz", label: "oz", step: 1 },
];

/** Singular unit label — used for the "per unit" calorie badge (e.g. "cal / cup"). */
export function unitLabel(unit: Unit): string {
  return UNITS.find((u) => u.value === unit)?.label ?? unit;
}

/** Only "cup" pluralizes in everyday US cooking usage; the rest read the same. */
export function pluralUnit(qty: number, unit: Unit): string {
  const base = unitLabel(unit);
  return unit === "cup" && qty !== 1 ? "cups" : base;
}

export function stepFor(unit: Unit): number {
  return UNITS.find((u) => u.value === unit)?.step ?? 1;
}

/** Format a quantity cleanly: 1.5 → "1.5", 2 → "2", 0.25 → "0.25". */
export function fmtQty(n: number): string {
  return Number(n.toFixed(2)).toString();
}

/** "1.5 cups", "3 each", "2 tbsp" */
export function qtyWithUnit(n: number, unit: Unit): string {
  return `${fmtQty(n)} ${pluralUnit(n, unit)}`;
}

// ---- Quantity sliders ----

/**
 * How far a quantity slider reaches by itself. Past this the slider only
 * extends to cover a number the user typed in — nobody drags to 500 oz, but
 * if you say you have 500 oz the handle still has to land on it.
 */
export const SLIDER_CAP = 100;

/** Where a slider tops out for a food nobody has much of yet. */
const SLIDER_BASE: Record<Unit, number> = {
  each: 12,
  cup: 12,
  tbsp: 32,
  tsp: 48,
  oz: 48
};

/** Round up to the next round-looking number: 13 → 20, 260 → 500. */
function niceCeil(n: number): number {
  if (n <= 0) return 0;
  const mag = 10 ** Math.floor(Math.log10(n));
  for (const m of [1, 2, 2.5, 5]) {
    if (n <= m * mag) return m * mag;
  }
  return 10 * mag;
}

/**
 * The `max` for a quantity slider on this food.
 *
 * Two rules, both about the handle staying where you put it:
 *  - the range is derived from a *round* number above the values involved, not
 *    from the current value, so dragging doesn't push the end of the track away
 *    from you;
 *  - it never stretches past `SLIDER_CAP` on its own. Only a quantity the user
 *    entered by hand takes it further, and then only far enough to show it.
 */
export function sliderMax(unit: Unit, ...values: number[]): number {
  const highest = Math.max(0, ...values.filter((v) => Number.isFinite(v)));
  const reach = Math.max(SLIDER_BASE[unit] ?? SLIDER_CAP, niceCeil(highest));
  return Math.max(stepFor(unit), Math.min(reach, Math.max(SLIDER_CAP, highest)));
}
