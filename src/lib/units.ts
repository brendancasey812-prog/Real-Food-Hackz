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

// ---- Buying units ----

/**
 * The units a shop sells in, which are not the units a kitchen cooks in.
 *
 * Ground beef is used by the ounce and sold by the pound; olive oil is used by
 * the tablespoon and sold by the litre. Making someone divide 7.99 by 16 in
 * their head to record a price is how prices end up wrong, so a price can be
 * entered the way the shelf label reads and converted here.
 */
export interface BuyUnit {
  key: string;
  label: string;
  /** How it reads on a price: "$7.99 / lb". */
  short: string;
  /** How many of the food's own unit one of these holds, or null when the two
   *  can't be reconciled without knowing what the food weighs. */
  per: (unit: Unit, gramsPerUnit: number | null) => number | null;
}

const G_PER_OZ = 28.349523;
const G_PER_LB = 453.59237;
const ML_PER_CUP = 236.588;

/** Grams into however many of the food's own unit that is. */
const fromGrams = (grams: number) => (unit: Unit, gramsPerUnit: number | null) => {
  if (unit === "oz") return grams / G_PER_OZ;
  if (gramsPerUnit == null || gramsPerUnit <= 0) return null;
  return grams / gramsPerUnit;
};

/**
 * Millilitres into the food's own unit — exact for the volume units, and
 * refused for the rest. A litre of oil and a pound of it are different
 * quantities, and nothing here knows how dense the oil is.
 */
const fromMl = (ml: number) => (unit: Unit) => {
  const cups = ml / ML_PER_CUP;
  if (unit === "cup") return cups;
  if (unit === "tbsp") return cups * 16;
  if (unit === "tsp") return cups * 48;
  return null;
};

export const BUY_UNITS: BuyUnit[] = [
  { key: "unit", label: "its own unit", short: "", per: () => 1 },
  { key: "lb", label: "pound", short: "lb", per: fromGrams(G_PER_LB) },
  { key: "oz", label: "ounce", short: "oz", per: fromGrams(G_PER_OZ) },
  { key: "kg", label: "kilogram", short: "kg", per: fromGrams(1000) },
  { key: "g", label: "100 grams", short: "100 g", per: fromGrams(100) },
  { key: "l", label: "litre", short: "L", per: fromMl(1000) },
  { key: "floz", label: "fluid ounce", short: "fl oz", per: fromMl(29.5735) },
  { key: "gal", label: "gallon", short: "gal", per: fromMl(3785.41) },
  { key: "dozen", label: "dozen", short: "dozen", per: (unit) => (unit === "each" ? 12 : null) },
];

/**
 * Convert a price quoted per `buyKey` into a price per the food's own unit.
 * Null when the two measures can't be bridged — better to say so than to
 * invent a number that silently mis-costs every recipe using the food.
 */
export function pricePerOwnUnit(
  price: number,
  buyKey: string,
  unit: Unit,
  gramsPerUnit: number | null,
): number | null {
  const buy = BUY_UNITS.find((b) => b.key === buyKey);
  if (!buy) return null;
  const held = buy.per(unit, gramsPerUnit);
  if (held == null || held <= 0) return null;
  return Math.round((price / held) * 1e4) / 1e4;
}

/** The reverse, for showing a stored price in the unit it was entered in. */
export function priceInBuyUnit(
  pricePerUnit: number,
  buyKey: string,
  unit: Unit,
  gramsPerUnit: number | null,
): number | null {
  const buy = BUY_UNITS.find((b) => b.key === buyKey);
  if (!buy) return null;
  const held = buy.per(unit, gramsPerUnit);
  if (held == null || held <= 0) return null;
  return Math.round(pricePerUnit * held * 100) / 100;
}

/**
 * A stored price written the way that food is bought.
 *
 * Everything is costed per the food's own unit, and this changes none of that
 * — it only decides how the number reads. Beef bought by the pound shows
 * "$7.99 / lb" rather than the $0.4994 an ounce the recipes divide by, so the
 * figure on the shelf matches the figure on the receipt.
 */
export function pricePerBuyUnit(
  pricePerUnit: number,
  food: { unit: Unit; buyUnit?: string },
  gramsPerUnit: number | null,
): { amount: number; label: string } {
  const own = { amount: pricePerUnit, label: unitLabel(food.unit) };
  const buy = BUY_UNITS.find((b) => b.key === food.buyUnit);
  if (!buy || buy.key === "unit") return own;
  const amount = priceInBuyUnit(pricePerUnit, buy.key, food.unit, gramsPerUnit);
  return amount == null ? own : { amount, label: buy.short };
}

/**
 * A quantity written the way that food is measured.
 *
 * The twin of `pricePerBuyUnit`, and for the same reason: a recipe counts beef
 * in ounces because that is how it cooks, but "2.25 lb" is what you carry home,
 * so a line reads in whichever of the two the food is kept in.
 */
export function amountPerBuyUnit(
  quantity: number,
  food: { unit: Unit; buyUnit?: string },
  gramsPerUnit: number | null,
): { amount: number; label: string } {
  const own = { amount: quantity, label: pluralUnit(quantity, food.unit) };
  const buy = BUY_UNITS.find((b) => b.key === food.buyUnit);
  if (!buy || buy.key === "unit") return own;
  const held = buy.per(food.unit, gramsPerUnit);
  if (held == null || held <= 0) return own;
  return { amount: Math.round((quantity / held) * 100) / 100, label: buy.short };
}
