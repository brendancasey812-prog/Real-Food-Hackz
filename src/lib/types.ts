// The shared vocabulary for the whole app. Every tab reads/writes these.

export type Location = "fridge" | "pantry" | "freezer";

export type Unit = "g" | "ml" | "piece" | "cup" | "tbsp" | "tsp";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/** A kind of food that can be stocked and used in recipes. */
export interface Food {
  id: string;
  name: string;
  unit: Unit;
  /** Calories per single `unit` of this food. */
  caloriesPerUnit: number;
  location: Location;
  emoji: string;
}

/** How much of a given food you currently have on hand. */
export interface InventoryItem {
  foodId: string;
  quantity: number;
}

/** One ingredient line inside a recipe. */
export interface RecipeIngredient {
  foodId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  emoji: string;
}

/** A recipe scheduled onto a specific day + meal slot. */
export interface PlannedMeal {
  id: string;
  /** ISO date string: yyyy-MM-dd */
  date: string;
  mealType: MealType;
  recipeId: string;
  servings: number;
}

export interface Goals {
  dailyCalorieTarget: number;
}

export interface AppData {
  foods: Food[];
  inventory: InventoryItem[];
  recipes: Recipe[];
  plan: PlannedMeal[];
  goals: Goals;
}
