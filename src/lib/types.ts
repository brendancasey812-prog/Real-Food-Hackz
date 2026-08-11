// The shared vocabulary for the whole app. Every tab reads/writes these.

export type Location = "fridge" | "pantry" | "freezer";

/** US cooking units. Each food uses whichever is most rational to cook with. */
export type Unit = "each" | "cup" | "tbsp" | "tsp" | "oz";

export type MealType = "breakfast" | "lunch" | "snack" | "dinner" | "extra";

/** Groups foods within a fridge/pantry section (protein, vegetables, legumes, …). */
export type FoodCategory =
  | "protein"
  | "dairy"
  | "grain"
  | "starch"
  | "legume"
  | "nut"
  | "fat"
  | "vegetable"
  | "fruit"
  | "condiment";

/** Grams of each macronutrient — used on foods (per unit) and rolled up everywhere. */
export interface Macros {
  protein: number;
  carbs: number;
  fat: number;
}

/** A kind of food that can be stocked and used in recipes. */
export interface Food {
  id: string;
  name: string;
  unit: Unit;
  /** Calories in one `unit` of this food. */
  caloriesPerUnit: number;
  /** Grams of protein / carbs / fat in one `unit`. */
  protein: number;
  carbs: number;
  fat: number;
  location: Location;
  category: FoodCategory;
  emoji: string;
  /** How this food entered the app. */
  source?: "manual" | "receipt_scan";
  /** Free-text detail appended from scans (e.g. "80/20", "organic"). */
  notes?: string;
}

/** One line the receipt scanner extracted (matches the vision model's JSON schema). */
export interface ScannedItem {
  category: "Protein" | "Fruit" | "Veggie" | "Pantry";
  food: string;
  variant: string;
  quantity: number;
  unit: "lb" | "oz" | "each" | "dozen" | "head";
  estimated: boolean;
}

export interface ScanResult {
  items: ScannedItem[];
  excluded_items: { raw_text: string; reason: string }[];
}

/** An append-only record of a stock change, for traceability. */
export interface PurchaseHistoryEntry {
  id: string;
  foodId: string;
  /** ISO date string */
  date: string;
  quantity: number;
  unit: string;
  source: "manual" | "receipt_scan";
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
  /** Which meal slot this recipe belongs to (groups the "add" picker). */
  category: MealType;
}

/** A recipe scheduled onto a specific day + meal slot. */
export interface PlannedMeal {
  id: string;
  /** ISO date string: yyyy-MM-dd */
  date: string;
  mealType: MealType;
  recipeId: string;
  servings: number;
  /** Optional custom placement (decimal hours). When set, overrides the
   *  default meal-time slot — lets any meal sit anywhere and be dragged. */
  start?: number;
  end?: number;
}

/** A free-form calendar event (not tied to a recipe), placed by the hour. */
export interface CalendarEvent {
  id: string;
  /** ISO date string: yyyy-MM-dd */
  date: string;
  title: string;
  /** Decimal hours, e.g. 13.5 = 1:30 PM. */
  start: number;
  end: number;
}

/** A shopping-list line the user added by hand (on top of the auto-derived list). */
export interface ManualGrocery {
  id: string;
  foodId: string;
  quantity: number;
}

export interface Goals {
  dailyCalorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
}

/** Who the plan is built for — shown on the dashboard. */
export interface Profile {
  label: string;
  heightIn: number;
  weightLb: number;
  age: number;
  activity: string;
}

export interface AppData {
  foods: Food[];
  inventory: InventoryItem[];
  recipes: Recipe[];
  plan: PlannedMeal[];
  events: CalendarEvent[];
  manualGroceries: ManualGrocery[];
  goals: Goals;
  profile: Profile;
  history: PurchaseHistoryEntry[];
}
