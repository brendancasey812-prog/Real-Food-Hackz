import type { FoodCategory } from "./types";

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
