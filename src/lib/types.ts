// The shared vocabulary for the whole app. Every tab reads/writes these.

export type Location = "fridge" | "pantry" | "freezer";

/** US cooking units. Each food uses whichever is most rational to cook with. */
export type Unit = "each" | "cup" | "tbsp" | "tsp" | "oz";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/** A kind of food that can be stocked and used in recipes. */
export interface Food {
  id: string;
  name: string;
  unit: Unit;
  /** Calories in one `unit` of this food (the heart of the nutrition tracking). */
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

/** A shopping-list line the user added by hand (on top of the auto-derived list). */
export interface ManualGrocery {
  id: string;
  foodId: string;
  quantity: number;
}

export interface Goals {
  dailyCalorieTarget: number;
}

export interface AppData {
  foods: Food[];
  inventory: InventoryItem[];
  recipes: Recipe[];
  plan: PlannedMeal[];
  manualGroceries: ManualGrocery[];
  goals: Goals;
}
