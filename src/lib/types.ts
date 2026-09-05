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
  | "condiment"
  | "spice";

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
  /** How this food entered the app. */
  source?: "manual" | "receipt_scan";
  /**
   * Where this food's calories and macros came from. Trust runs
   * scan > manual > usda, and the USDA reference never overwrites the first two.
   */
  nutritionSource?: "scan" | "manual" | "usda";
  /** The FDC record backing a "usda" figure, for traceability. */
  fdcId?: number;
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

/** A sub-recipe included inside another recipe (e.g. Mexican rice inside
 *  Taco Tuesday). `servings` is how many servings of the sub-recipe are used. */
export interface RecipeComponent {
  recipeId: string;
  servings: number;
}

export interface Recipe {
  id: string;
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  /** Other recipes folded into this one. Optional for backward compatibility. */
  components?: RecipeComponent[];
  steps: string[];
  /** Downscaled data-URL photo shown in Cookbook V2. */
  image?: string;
  /** Total cook time in minutes. */
  cookTimeMin?: number;
  /** Which meal slot this recipe belongs to (groups the "add" picker). */
  category: MealType;
  /**
   * A stand-in recipe wrapping a single food, so one apple can be planned on a
   * day the way a real recipe can. Kept out of the Cookbook's recipe lists —
   * the Fruit tab is where these are created and browsed.
   */
  single?: boolean;
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

export type Sex = "female" | "male" | "intersex";

/** The five focus areas a user can opt into (Settings → Goals & focus areas). */
export type FocusArea =
  | "present"
  | "productive"
  | "athletic"
  | "health"
  | "stress";

/** Who the plan is built for — shown on the dashboard. */
export interface Profile {
  label: string;
  heightIn: number;
  weightLb: number;
  age: number;
  activity: string;
  /** ISO date string (yyyy-MM-dd). Age is derived from this when set. */
  birthDate?: string;
  sex?: Sex;
}

/** Who the app is planning for. "couple" is a family of exactly two. */
export type HouseholdMode = "individual" | "couple" | "family";

/**
 * An extra person the plan feeds, beyond the primary user (whose body and
 * goals live in `profile` / `goals`). So individual = 0 members here,
 * couple = 1, family = however many were added.
 */
export interface Member {
  id: string;
  name: string;
  heightIn: number;
  weightLb: number;
  age: number;
  birthDate?: string;
  sex?: Sex;
  goals: Goals;
}

// ---- Cost & stores ----

/**
 * A grocery store the user shops at. `lat`/`lng` are optional because a store
 * can be added by hand before (or without) geocoding — it just won't appear on
 * the map or get a distance until coordinates are known.
 */
export interface Store {
  id: string;
  name: string;
  /** Street line, e.g. "1450 Ocean Ave". Optional — city/state/zip is enough. */
  address?: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
  /** The store's site, for checking hours or ordering — opened from the tab. */
  website?: string;
  /** This store's id at a live price source, when it was matched to one. */
  krogerLocationId?: string;
  /** How the store got here: typed in, or pulled from the nearby-store search. */
  source?: "manual" | "search";
}

/**
 * What one `unit` of a food costs at one store — e.g. chicken is priced per
 * `oz`, milk per `cup`, so the cost of an ingredient line is simply
 * `quantity x pricePerUnit`, exactly mirroring how calories work.
 *
 * `storeId` may be BASE_STORE_ID, which is the fallback price used for any
 * store that has no price of its own for that food.
 */
export interface Price {
  storeId: string;
  foodId: string;
  /** US dollars per one `unit` of the food. */
  pricePerUnit: number;
  /** ISO date string (yyyy-MM-dd) — when this price was last touched. */
  updatedAt: string;
  /** The zip the price was observed in, when it came from a live lookup. */
  zip?: string;
  /** Where the number came from. Absent means it was typed in. */
  source?: PriceSourceId;
}

/** Where a price came from. */
export type PriceSourceId = "kroger" | "manual" | "base";

/**
 * One observed price for one ingredient at one store, as a live source
 * reported it. Cached rather than re-fetched, and kept separate from `Price`
 * so a lookup never silently overwrites a number you set yourself.
 */
export interface PriceQuote {
  foodId: string;
  /** Normalized ingredient name — no brand, no pack size. */
  ingredient: string;
  /** Dollars per one of the food's own unit. Null when unavailable. */
  pricePerUnit: number | null;
  unit: Unit;
  /** The shelf price, before dividing by pack size. */
  packagePrice?: number;
  /** The pack size as the source described it. */
  packageSize?: string;
  /** The product the source matched, for checking its work. */
  matchedProduct?: string;
  storeId: string;
  zip: string;
  /** ISO date string (yyyy-MM-dd). */
  lastRefreshed: string;
  source: PriceSourceId;
  /** False when the store carries no price for it. */
  available: boolean;
  note?: string;
}

/** Where the user is shopping from, used to sort stores by distance. */
export interface HomeLocation {
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
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
  /** Individual / couple / family — drives household totals across the app. */
  householdMode: HouseholdMode;
  /** Extra people beyond the primary user; empty when mode is "individual". */
  members: Member[];
  focusAreas: FocusArea[];
  history: PurchaseHistoryEntry[];
  /** Stores the user shops at (the base price row is not one of these). */
  stores: Store[];
  /** Per-store, per-food unit prices. */
  prices: Price[];
  /** Cached live-source quotes, refreshed daily rather than per request. */
  priceQuotes: PriceQuote[];
  /** Which store's prices the whole app is costed against. */
  selectedStoreId: string;
  /** Where 'nearby' is measured from. */
  home: HomeLocation;
}
