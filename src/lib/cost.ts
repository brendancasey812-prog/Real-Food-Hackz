// Cost roll-up: the money twin of the calorie logic in store.ts.
//
// Every food is priced per its own `unit` (chicken per oz, milk per cup), so an
// ingredient line costs `quantity x pricePerUnit` — exactly the shape of
// `ingredientCalories`. Recipes, the plan and the grocery list all roll up from
// that one number, which is why changing a price moves every tab at once.
//
// Prices are per store. A food with no price at the selected store falls back to
// the BASE price row; a food with neither is *unpriced*, and every total here
// reports how many lines it could actually price so the UI never shows a
// confident dollar figure that is silently missing half its ingredients.

import type { Food, Price, Recipe, PlannedMeal } from "./types";

/** The pseudo-store holding fallback prices used when a store has none. */
export const BASE_STORE_ID = "base";

/**
 * The pseudo-store meaning "whichever shop sells it cheapest".
 *
 * Once you shop at more than one place, the honest cost of a recipe is not
 * what one store charges — it is what you would actually pay, buying each
 * thing where it is cheapest. Selecting this costs everything that way, and
 * because it is just another store id, every total in the app follows without
 * any of them knowing about it.
 */
export const BEST_STORE_ID = "best";

/** True for the two ids that aren't real shops. */
export const isPseudoStore = (id: string) =>
  id === BASE_STORE_ID || id === BEST_STORE_ID;

/** A money total plus how complete it is. */
export interface CostTotals {
  /** Dollars, summed over the lines that had a price. */
  cost: number;
  /** How many ingredient lines were priced. */
  priced: number;
  /** How many ingredient lines there were in total. */
  lines: number;
}

const empty = (): CostTotals => ({ cost: 0, priced: 0, lines: 0 });

function add(a: CostTotals, b: CostTotals): CostTotals {
  return { cost: a.cost + b.cost, priced: a.priced + b.priced, lines: a.lines + b.lines };
}

/** True when every line in the total carried a price. */
export function isComplete(t: CostTotals): boolean {
  return t.lines > 0 && t.priced === t.lines;
}

/** `$4.20`, or `$1,204.50` for large numbers. */
export function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Compact money for dense table cells: `$4.20`, `$0.08`. */
export function fmtMoneyShort(n: number): string {
  return `$${n.toFixed(2)}`;
}

export interface ResolvedPrice {
  pricePerUnit: number;
  /** Where the number came from: the store asked for, the base fallback, or
   *  the cheapest shop that sells it. */
  source: "store" | "base" | "best";
  updatedAt: string;
  /** Which store actually charged this, when the answer came from elsewhere. */
  storeId?: string;
}

/** Every price recorded for one food, cheapest first. */
export function pricesForFood(prices: Price[], foodId: string): Price[] {
  return prices
    .filter((p) => p.foodId === foodId)
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit);
}

/**
 * The cheapest price anyone charges for a food.
 *
 * Base prices are typical figures rather than a shop you can walk into, so
 * they only answer when no real store has priced the food — otherwise a
 * guessed number could undercut a real one and quietly make every total wrong.
 */
export function bestPriceFor(prices: Price[], foodId: string): ResolvedPrice | null {
  const rows = pricesForFood(prices, foodId);
  const real = rows.filter((p) => p.storeId !== BASE_STORE_ID);
  const pick = real[0] ?? rows[0];
  if (!pick) return null;
  return {
    pricePerUnit: pick.pricePerUnit,
    source: pick.storeId === BASE_STORE_ID ? "base" : "best",
    updatedAt: pick.updatedAt,
    storeId: pick.storeId,
  };
}

/**
 * The price in force for a food at a store: the store's own price if it has
 * one, otherwise the base price, otherwise null (unpriced).
 */
export function priceFor(
  prices: Price[],
  storeId: string,
  foodId: string,
): ResolvedPrice | null {
  if (storeId === BEST_STORE_ID) return bestPriceFor(prices, foodId);

  const own = prices.find((p) => p.storeId === storeId && p.foodId === foodId);
  if (own) {
    return { pricePerUnit: own.pricePerUnit, source: "store", updatedAt: own.updatedAt, storeId };
  }
  if (storeId !== BASE_STORE_ID) {
    const base = prices.find((p) => p.storeId === BASE_STORE_ID && p.foodId === foodId);
    if (base) {
      return {
        pricePerUnit: base.pricePerUnit,
        source: "base",
        updatedAt: base.updatedAt,
        storeId: BASE_STORE_ID,
      };
    }
  }
  return null;
}

/** What one ingredient line costs, or null when the food has no price. */
export function ingredientCost(
  ing: { foodId: string; quantity: number },
  prices: Price[],
  storeId: string,
): number | null {
  const p = priceFor(prices, storeId, ing.foodId);
  return p ? p.pricePerUnit * ing.quantity : null;
}

/** Cost of a bare quantity of one food (used by the grocery list). */
export function quantityCost(
  foodId: string,
  quantity: number,
  prices: Price[],
  storeId: string,
): number | null {
  const p = priceFor(prices, storeId, foodId);
  return p ? p.pricePerUnit * quantity : null;
}

/** Raw cost of the WHOLE recipe (all servings), expanding sub-recipes. */
function grossCost(
  recipe: Recipe,
  recipes: Recipe[],
  prices: Price[],
  storeId: string,
  seen: Set<string>,
): CostTotals {
  let acc = empty();
  for (const ing of recipe.ingredients) {
    const c = ingredientCost(ing, prices, storeId);
    acc = add(acc, { cost: c ?? 0, priced: c == null ? 0 : 1, lines: 1 });
  }
  for (const comp of recipe.components ?? []) {
    if (seen.has(comp.recipeId) || comp.recipeId === recipe.id) continue;
    const sub = recipes.find((r) => r.id === comp.recipeId);
    if (!sub) continue;
    const per = perServingCostRaw(sub, recipes, prices, storeId, new Set(seen).add(recipe.id));
    acc = add(acc, {
      cost: per.cost * comp.servings,
      priced: per.priced,
      lines: per.lines
    });
  }
  return acc;
}

function perServingCostRaw(
  recipe: Recipe,
  recipes: Recipe[],
  prices: Price[],
  storeId: string,
  seen: Set<string>,
): CostTotals {
  const g = grossCost(recipe, recipes, prices, storeId, seen);
  const s = recipe.servings || 1;
  return { cost: g.cost / s, priced: g.priced, lines: g.lines };
}

/** Total cost to cook the whole recipe, including sub-recipes. */
export function recipeTotalCost(
  recipe: Recipe,
  recipes: Recipe[],
  prices: Price[],
  storeId: string,
): CostTotals {
  return grossCost(recipe, recipes, prices, storeId, new Set());
}

/** Cost of one serving of a recipe, including sub-recipes. */
export function recipeCostPerServing(
  recipe: Recipe,
  recipes: Recipe[],
  prices: Price[],
  storeId: string,
): CostTotals {
  return perServingCostRaw(recipe, recipes, prices, storeId, new Set());
}

/** Cost of a set of planned meals (the week's food spend). */
export function plannedCost(
  meals: PlannedMeal[],
  recipes: Recipe[],
  prices: Price[],
  storeId: string,
): CostTotals {
  let acc = empty();
  for (const meal of meals) {
    const recipe = recipes.find((r) => r.id === meal.recipeId);
    if (!recipe) continue;
    const per = recipeCostPerServing(recipe, recipes, prices, storeId);
    acc = add(acc, { cost: per.cost * meal.servings, priced: per.priced, lines: per.lines });
  }
  return acc;
}

/** Cost of a `foodId -> quantity` map, as produced by `neededQuantities`. */
export function quantitiesCost(
  need: Record<string, number>,
  prices: Price[],
  storeId: string,
): CostTotals {
  let acc = empty();
  for (const [foodId, qty] of Object.entries(need)) {
    const c = quantityCost(foodId, qty, prices, storeId);
    acc = add(acc, { cost: c ?? 0, priced: c == null ? 0 : 1, lines: 1 });
  }
  return acc;
}

/** How many of the given foods carry a usable price at this store. */
export function priceCoverage(
  foods: Food[],
  prices: Price[],
  storeId: string,
): { priced: number; total: number } {
  const priced = foods.filter((f) => priceFor(prices, storeId, f.id) !== null).length;
  return { priced, total: foods.length };
}

/**
 * Total basket cost of everything on hand — what the kitchen is "worth".
 */
export function inventoryValue(
  inventory: { foodId: string; quantity: number }[],
  prices: Price[],
  storeId: string,
): CostTotals {
  let acc = empty();
  for (const item of inventory) {
    if (item.quantity <= 0) continue;
    const c = quantityCost(item.foodId, item.quantity, prices, storeId);
    acc = add(acc, { cost: c ?? 0, priced: c == null ? 0 : 1, lines: 1 });
  }
  return acc;
}
