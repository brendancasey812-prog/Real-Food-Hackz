import type { Food, FoodCategory, Recipe } from "./types";

/** Display order + label for food categories (used to group the Kitchen). */
export const FOOD_CATEGORIES: { key: FoodCategory; label: string }[] = [
  { key: "protein", label: "Protein" },
  { key: "dairy", label: "Dairy" },
  { key: "vegetable", label: "Vegetables" },
  { key: "fruit", label: "Fruit" },
  { key: "grain", label: "Grains" },
  { key: "starch", label: "Starchy veg" },
  { key: "legume", label: "Legumes" },
  { key: "nut", label: "Nuts & seeds" },
  { key: "fat", label: "Fats & oils" },
  { key: "condiment", label: "Condiments" },
  { key: "spice", label: "Spices & herbs" },
];

export const FOOD_CATEGORY_LABEL: Record<FoodCategory, string> = Object.fromEntries(
  FOOD_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<FoodCategory, string>;

/** One representative emoji per food category, for the Meal Plan V2 emoji view. */
export const FOOD_CATEGORY_EMOJI: Record<FoodCategory, string> = {
  protein: "🍗",
  dairy: "🧀",
  vegetable: "🥦",
  fruit: "🍎",
  grain: "🌾",
  starch: "🥔",
  legume: "🫘",
  nut: "🥜",
  fat: "🧈",
  condiment: "🧂",
  spice: "🌿",
};

/** A dish with no clear dominant ingredient — an empty recipe, say. */
const DEFAULT_RECIPE_EMOJI = "🍽️";

/**
 * A recipe's emoji, standing in for a photo when Meal Plan V2 is in its
 * emoji view: whichever food category contributes the most calories to one
 * serving (sub-recipes aren't unpacked for this — a good-enough sketch of
 * the dish, not a precise ingredient audit).
 */
export function recipeEmoji(recipe: Recipe, foods: Food[]): string {
  const byCategory = new Map<FoodCategory, number>();
  for (const ing of recipe.ingredients) {
    const food = foods.find((f) => f.id === ing.foodId);
    if (!food) continue;
    const cal = food.caloriesPerUnit * ing.quantity;
    byCategory.set(food.category, (byCategory.get(food.category) ?? 0) + cal);
  }
  let best: FoodCategory | null = null;
  let bestCal = -1;
  for (const [category, cal] of byCategory) {
    if (cal > bestCal) { bestCal = cal; best = category; }
  }
  return best ? FOOD_CATEGORY_EMOJI[best] : DEFAULT_RECIPE_EMOJI;
}

/**
 * The order foods appear in.
 *
 * Anything the user has arranged comes first, in the position they put it;
 * everything else follows alphabetically. That way arranging three foods on a
 * shelf doesn't send the other twenty into an order nobody chose.
 */
export function byShelfOrder(a: Food, b: Food): number {
  const ao = a.order ?? Number.POSITIVE_INFINITY;
  const bo = b.order ?? Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  return a.name.localeCompare(b.name);
}
