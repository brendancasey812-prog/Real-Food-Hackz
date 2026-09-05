import type { AppData, HouseholdMode, Recipe } from "./types";

/**
 * How many people the plan is feeding, and what that means for a recipe.
 *
 * The household setting used to only affect the dashboard's calorie targets;
 * portions were left to be worked out by hand every time. These helpers put
 * the same number behind every "servings" field in the app, so a recipe that
 * serves one and a family of four are reconciled once, here.
 */

export const HOUSEHOLD_LABEL: Record<HouseholdMode, string> = {
  individual: "Individual",
  couple: "Couple",
  family: "Family",
};

/** Mouths at the table: you, plus anyone added in Settings. */
export function householdSize(
  s: Pick<AppData, "householdMode" | "members">,
): number {
  if (s.householdMode === "individual") return 1;
  return Math.max(1, 1 + (s.members?.length ?? 0));
}

/** "your household", "the two of you", "your family of 4". */
export function householdName(
  s: Pick<AppData, "householdMode" | "members">,
): string {
  const n = householdSize(s);
  if (s.householdMode === "individual") return "you";
  if (s.householdMode === "couple") return "the two of you";
  return `your family of ${n}`;
}

/**
 * What one batch of a recipe does for this household: how many sittings it
 * covers, and whether it leaves an awkward remainder.
 */
export interface Portions {
  /** People at the table. */
  size: number;
  /** Servings the recipe makes as written. */
  servings: number;
  /** Whole meals for everyone that a batch covers. */
  meals: number;
  /** Servings left over after those whole meals. */
  leftover: number;
  /** Servings a batch would need to feed everyone a whole number of times. */
  suggested: number;
}

export function portionsFor(recipe: Recipe, size: number): Portions {
  const servings = Math.max(1, recipe.servings || 1);
  const meals = Math.floor(servings / size);
  return {
    size,
    servings,
    meals,
    leftover: servings - meals * size,
    // Round up to the next whole sitting, but never below one.
    suggested: Math.max(size, Math.ceil(servings / size) * size),
  };
}

/** A short line for a card: what a batch is worth to this household. */
export function portionNote(p: Portions): string {
  if (p.size === 1) {
    return `${p.servings} serving${p.servings === 1 ? "" : "s"}`;
  }
  if (p.meals === 0) {
    return `${p.servings} of ${p.size} servings — short for one sitting`;
  }
  const meals = `${p.meals} meal${p.meals === 1 ? "" : "s"} for ${p.size}`;
  return p.leftover > 0
    ? `${meals} + ${p.leftover} spare`
    : meals;
}

/**
 * Rescale a recipe to make `servings` instead of what it makes now, moving
 * every ingredient and sub-recipe with it — so a portion stays the same size
 * and there is simply more of it.
 */
export function scaleRecipe(recipe: Recipe, servings: number): Recipe {
  const from = Math.max(1, recipe.servings || 1);
  const to = Math.max(1, Math.round(servings));
  if (to === from) return recipe;
  const factor = to / from;
  const round = (n: number) => Number((n * factor).toFixed(2));
  return {
    ...recipe,
    servings: to,
    ingredients: recipe.ingredients.map((i) => ({ ...i, quantity: round(i.quantity) })),
    components: recipe.components?.map((c) => ({ ...c, servings: round(c.servings) })),
  };
}
