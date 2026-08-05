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
