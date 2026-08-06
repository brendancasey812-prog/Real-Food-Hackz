import type { FoodCategory } from "./types";

/** Display order + label + emoji for food categories (used to group the Kitchen). */
export const FOOD_CATEGORIES: { key: FoodCategory; label: string; emoji: string }[] = [
  { key: "protein", label: "Protein", emoji: "🥩" },
  { key: "dairy", label: "Dairy", emoji: "🧀" },
  { key: "vegetable", label: "Vegetables", emoji: "🥦" },
  { key: "fruit", label: "Fruit", emoji: "🍎" },
  { key: "grain", label: "Grains", emoji: "🌾" },
  { key: "starch", label: "Starchy veg", emoji: "🥔" },
  { key: "legume", label: "Legumes", emoji: "🫘" },
  { key: "nut", label: "Nuts & seeds", emoji: "🥜" },
  { key: "fat", label: "Fats & oils", emoji: "🫒" },
  { key: "condiment", label: "Condiments", emoji: "🧂" },
];

export const FOOD_CATEGORY_LABEL: Record<FoodCategory, string> = Object.fromEntries(
  FOOD_CATEGORIES.map((c) => [c.key, c.label]),
) as Record<FoodCategory, string>;
