import raw from "./usda-foods.json";
import type { Food, FoodCategory, Unit } from "./types";

/**
 * USDA FoodData Central (Foundation Foods) as the app's fallback nutrition
 * reference — a lookup table, not a tab.
 *
 * A food's numbers come from, in order of trust:
 *   1. a nutrition label the user scanned      (source "scan")
 *   2. numbers the user typed in themselves    (source "manual")
 *   3. this table                              (source "usda")
 *   4. whatever the food shipped with
 *
 * So nothing here ever overwrites something the user established; it fills
 * gaps and offers itself where a food has no better answer.
 *
 * Regenerate with: node scripts/build-usda.mjs <FDC foundation food json>
 * Data is public domain: https://fdc.nal.usda.gov/
 */

export interface UsdaFood {
  /** FDC description, e.g. "Beef, ground, 80% lean meat / 20% fat, raw". */
  n: string;
  /** FDC food category. */
  c: string;
  /** fdcId, so a value can be traced back to the source record. */
  id: number;
  /** Per 100 g: calories, protein, carbs, fat. */
  k: number;
  p: number;
  cb: number;
  f: number;
  /** Grams in one cup / one item, when FDC publishes a portion for it. */
  gc: number | null;
  ge: number | null;
}

const DB = raw as { gPerOz: number; foods: UsdaFood[] };
export const USDA_FOODS: UsdaFood[] = DB.foods;
export const USDA_COUNT = DB.foods.length;

const G_PER_OZ = DB.gPerOz;
const TBSP_PER_CUP = 16;
const TSP_PER_CUP = 48;

/** Per-unit figures in the shape a Food stores them. */
export interface UsdaNutrition {
  caloriesPerUnit: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Grams in one `unit` of this entry, or null when FDC gives no basis. */
export function gramsPerUnit(entry: UsdaFood, unit: Unit): number | null {
  switch (unit) {
    case "oz":
      return G_PER_OZ;
    case "cup":
      return entry.gc;
    case "tbsp":
      return entry.gc == null ? null : entry.gc / TBSP_PER_CUP;
    case "tsp":
      return entry.gc == null ? null : entry.gc / TSP_PER_CUP;
    case "each":
      return entry.ge;
  }
}

/** Scale the per-100 g figures to one of the app's units. */
export function usdaPerUnit(entry: UsdaFood, unit: Unit): UsdaNutrition | null {
  const grams = gramsPerUnit(entry, unit);
  if (grams == null || grams <= 0) return null;
  const scale = grams / 100;
  const g = (v: number) => Math.round(v * scale * 10) / 10;
  return {
    caloriesPerUnit: Math.round(entry.k * scale),
    protein: g(entry.p),
    carbs: g(entry.cb),
    fat: g(entry.f)
  };
}

// ---- Name matching ----

/** Words that describe preparation or sourcing rather than the food itself. */
const NOISE = new Set([
  "raw", "cooked", "nfs", "commercial", "all", "types", "varieties", "variety",
  "with", "without", "and", "or", "the", "of", "includes", "added", "unprepared",
  "prepared", "unspecified", "regular", "pack", "solids", "drained", "boneless",
  "separable", "lean", "only", "trimmed", "fat", "select", "choice", "grade",
  "whole", "fresh", "plain", "unsalted", "salted", "enriched", "unenriched",
  "national", "brands", "reduced", "low", "light", "dry", "dried", "canned",
  "frozen", "value", "usda", "product", "products", "food", "foods",
]);

/** Crude singular form, so "Onion" finds "Onions, red, raw". */
function stem(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(stem);

const meaningful = (tokens: string[]) => tokens.filter((t) => !NOISE.has(t) && t.length > 1);

/**
 * FDC descriptions run "head noun, qualifier, qualifier". When the head itself
 * carries a word the query lacks *alongside* one it has, the entry names a
 * different food: "Almond butter" is not "Butter". That has to be penalised
 * hard, or every butter in the table matches.
 */
function compoundMismatch(entryName: string, q: string[]): boolean {
  const head = meaningful(tokenize(entryName.split(",")[0] ?? ""));
  if (head.length < 2) return false;
  const shares = head.some((t) => q.includes(t));
  const missing = head.some((t) => !q.includes(t));
  return shares && missing;
}

/**
 * Head nouns that name a *transformed* form. "Flour, almond" is filed under
 * almonds but is not almonds, so it must not win over "Nuts, almonds" on a
 * tie — which it otherwise does, alphabetically.
 */
const PROCESSED_HEADS = new Set([
  "flour", "juice", "puree", "powder", "oil", "syrup", "paste", "extract",
  "concentrate", "chips", "flakes", "meal", "starch",
]);

/**
 * The record has to actually be about the food asked for. FDC names its head
 * noun first, so if the query appears nowhere in it the food is probably only
 * mentioned as an ingredient or a packing medium — "Anchovies, canned in olive
 * oil" is not olive oil. The one legitimate exception is FDC's category-first
 * form, "Nuts, almonds" or "Sauce, salsa", where the specific food is the
 * second segment and no preposition intervenes.
 */
function headMismatch(entryName: string, q: string[]): boolean {
  const segments = entryName.split(",").map((x) => x.trim());
  const head = meaningful(tokenize(segments[0] ?? ""));
  if (head.some((t) => q.includes(t))) return false;
  // A processed form the query didn't ask for is the wrong record.
  if (head.some((t) => PROCESSED_HEADS.has(t))) return true;

  const second = segments[1] ?? "";
  const namesItPlainly =
    meaningful(tokenize(second)).some((t) => q.includes(t)) &&
    !/\b(in|with|on|from)\b/i.test(second);
  return !namesItPlainly;
}

export interface UsdaMatch {
  entry: UsdaFood;
  /** 0–1. Above ~0.6 the match is usually the same food. */
  score: number;
}

/**
 * Find the USDA entry that best describes a food name.
 *
 * Scores on how much of the app's name the entry accounts for, then prefers
 * the least padded description among the ties — "Spinach, raw" should beat
 * "Spinach, canned, regular pack, drained solids" for a food called "Spinach".
 */
export function matchUsda(name: string, minScore = 0.6): UsdaMatch | null {
  const q = meaningful(tokenize(name));
  if (q.length === 0) return null;

  let best: UsdaMatch | null = null;
  for (const entry of USDA_FOODS) {
    const all = tokenize(entry.n);
    const core = meaningful(all);
    if (core.length === 0) continue;

    const hits = q.filter((t) => all.includes(t)).length;
    if (hits === 0) continue;

    const recall = hits / q.length;
    // Shorter descriptions are more likely to be the plain form of the food.
    const brevity = 1 / (1 + Math.max(0, core.length - hits) * 0.16);
    // The head noun carries most of the meaning: "Beef, ground…" is beef.
    const headBonus = q.includes(core[0]) ? 0.12 : 0;
    const penalty = (compoundMismatch(entry.n, q) ? 0.45 : 1) * (headMismatch(entry.n, q) ? 0.4 : 1);
    const score = Math.min(1, (recall * brevity + headBonus) * penalty);

    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= minScore ? best : null;
}

/** The USDA numbers for a food, in that food's own unit. */
export function usdaFor(food: Pick<Food, "name" | "unit">): {
  match: UsdaMatch;
  nutrition: UsdaNutrition;
} | null {
  const match = matchUsda(food.name);
  if (!match) return null;
  const nutrition = usdaPerUnit(match.entry, food.unit);
  return nutrition ? { match, nutrition } : null;
}

/**
 * Typical weight of one unit, when USDA has no figure for this food.
 *
 * Deliberately coarse: these are the difference between a receipt line
 * converting at all and the user typing a number by hand, and a cup of
 * chopped vegetables really is about 120 g whatever the vegetable. Anything
 * derived from these is labelled an estimate.
 */
const CUP_GRAMS: Record<FoodCategory, number> = {
  protein: 140,
  dairy: 240,
  grain: 180,
  starch: 200,
  legume: 180,
  nut: 140,
  fat: 218,
  vegetable: 120,
  fruit: 150,
  condiment: 240,
  spice: 100,
};

const TBSP_PER_CUP_ = 16;
const TSP_PER_CUP_ = 48;

/**
 * What one of a thing typically weighs. Only 30 of the 323 USDA records carry
 * a per-item weight, so without this a receipt for 2.63 lb of bananas can't
 * say how many bananas that is — which is the whole question.
 *
 * Longest key wins, so "sweet potato" beats "potato".
 */
const EACH_GRAMS: [string, number][] = [
  ["sweet potato", 130], ["bell pepper", 119], ["garlic clove", 3],
  ["mozzarella ball", 10], ["english muffin", 57], ["corn tortilla", 26],
  ["tortilla", 45], ["banana", 118], ["apple", 200], ["orange", 131],
  ["lemon", 84], ["lime", 67], ["peach", 150], ["pear", 178], ["kiwi", 75],
  ["avocado", 200], ["potato", 173], ["onion", 110], ["shallot", 25],
  ["garlic", 45], ["tomato", 123], ["cucumber", 300], ["carrot", 61],
  ["pepper", 119], ["egg", 50], ["bread", 28], ["roll", 43], ["bun", 43],
  ["muffin", 57], ["wrap", 62], ["sausage", 57], ["cheese stick", 28],
];

/** The typical weight of one of this food, by name. */
function eachGrams(name: string): number | null {
  const n = name.toLowerCase();
  let best: { key: string; grams: number } | null = null;
  for (const [key, grams] of EACH_GRAMS) {
    if (n.includes(key) && (!best || key.length > best.key.length)) {
      best = { key, grams };
    }
  }
  return best?.grams ?? null;
}

/**
 * How much one of a food's own units weighs, and how sure we are.
 *
 * `usdaFor` can't answer this: it returns null whenever the reference has no
 * gram weight, which is exactly the case we need to handle rather than give
 * up on. This goes to the matched entry directly, then falls back to a
 * category average — because "about right" beats making someone weigh their
 * groceries.
 */
export function gramsForFood(
  food: Pick<Food, "name" | "unit" | "category">,
): { grams: number; estimated: boolean } | null {
  const match = matchUsda(food.name);
  const known = match ? gramsPerUnit(match.entry, food.unit) : null;
  if (known != null && known > 0) return { grams: known, estimated: false };

  // An ounce is an ounce; nothing to estimate.
  if (food.unit === "oz") return { grams: G_PER_OZ, estimated: false };

  const cup = CUP_GRAMS[food.category];
  if (cup == null) return null;
  switch (food.unit) {
    case "cup": return { grams: cup, estimated: true };
    case "tbsp": return { grams: cup / TBSP_PER_CUP_, estimated: true };
    case "tsp": return { grams: cup / TSP_PER_CUP_, estimated: true };
    // "Each" can't be averaged across categories — an egg and a watermelon are
    // both one of something — so it needs the food to be recognised by name.
    case "each": {
      const g = eachGrams(food.name);
      return g == null ? null : { grams: g, estimated: true };
    }
  }
}

/** True when a food has no real nutrition on it yet. */
export const missingNutrition = (f: Food) =>
  !f.caloriesPerUnit && !f.protein && !f.carbs && !f.fat;

/**
 * Whether the reference is allowed to write over what a food already has.
 * Anything the user established wins; so does a food that already carries
 * numbers from somewhere.
 */
export function canApplyUsda(f: Food): boolean {
  if (f.nutritionSource === "scan" || f.nutritionSource === "manual") return false;
  return true;
}

export const SOURCE_LABEL: Record<NonNullable<Food["nutritionSource"]>, string> = {
  scan: "From a label you scanned",
  manual: "Entered by you",
  usda: "USDA FoodData Central"
};
