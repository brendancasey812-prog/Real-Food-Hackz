import { startOfMonth, endOfMonth, addDays, format } from "date-fns";
import type { AppData, Food, FoodCategory, Recipe, MealType, PlannedMeal } from "./types";
import { mondayIndex } from "./week";

// Which food-type bucket each food id belongs to (groups the Kitchen).
const CATS: Record<FoodCategory, string[]> = {
  protein: ["egg", "eggwhite", "chicken", "chickenthigh", "salmon", "whitefish", "beef937", "sirloin", "groundturkey", "turkeydeli", "turkeysausage", "shrimp", "tuna", "proteinpowder", "proteinshake"],
  dairy: ["greekyogurt", "cottagecheese", "stringcheese", "cheese", "milk"],
  grain: ["oats", "brownrice", "whiterice", "quinoa", "farro", "wwbread", "wrap", "roll", "crackers", "englishmuffin", "granola"],
  starch: ["potato", "sweetpotato"],
  legume: ["blackbeans", "beans", "hummus"],
  nut: ["peanutbutter", "almondbutter", "almonds", "walnuts", "mixednuts", "trailmix"],
  fat: ["oliveoil", "sesameoil", "butter", "vinaigrette", "caesar", "avocado"],
  vegetable: ["broccoli", "spinach", "mushrooms", "peppers", "onion", "carrots", "greens", "brussels", "greenbeans", "asparagus", "tomatoes", "rootveg"],
  fruit: ["banana", "berries", "apple", "orange", "grapes", "pineapple", "fruitsalad", "oj"],
  condiment: ["honey", "salsa", "cinnamon", "coffee"],
};
const CAT_OF: Record<string, FoodCategory> = {};
(Object.keys(CATS) as FoodCategory[]).forEach((c) => CATS[c].forEach((id) => (CAT_OF[id] = c)));

// Compact food builder: id, name, unit, calories, protein, carbs, fat, location, emoji.
type Loc = Food["location"];
type U = Food["unit"];
const F = (
  id: string, name: string, unit: U, cal: number,
  protein: number, carbs: number, fat: number, location: Loc, emoji: string,
): Food => ({ id, name, unit, caloriesPerUnit: cal, protein, carbs, fat, location, category: CAT_OF[id] ?? "condiment", emoji });

const foods: Food[] = [
  // Proteins & dairy
  F("egg", "Eggs", "each", 78, 6.3, 0.6, 5.3, "fridge", "🥚"),
  F("eggwhite", "Egg whites", "each", 17, 3.6, 0.2, 0.1, "fridge", "🥚"),
  F("chicken", "Chicken breast", "oz", 47, 8.8, 0, 1.0, "fridge", "🍗"),
  F("chickenthigh", "Chicken thigh", "oz", 59, 7.5, 0, 3.1, "fridge", "🍗"),
  F("salmon", "Salmon", "oz", 58, 6.3, 0, 3.4, "fridge", "🐟"),
  F("whitefish", "White fish (cod/tilapia)", "oz", 33, 6.8, 0, 0.7, "fridge", "🐟"),
  F("beef937", "Ground beef 93/7", "oz", 51, 7.5, 0, 2.2, "fridge", "🥩"),
  F("sirloin", "Sirloin steak", "oz", 57, 8.6, 0, 2.3, "fridge", "🥩"),
  F("groundturkey", "Ground turkey", "oz", 50, 7.0, 0, 2.4, "fridge", "🦃"),
  F("turkeydeli", "Turkey (deli)", "oz", 30, 5.0, 1, 0.6, "fridge", "🦃"),
  F("turkeysausage", "Turkey sausage", "each", 65, 6, 1, 4, "fridge", "🌭"),
  F("shrimp", "Shrimp", "oz", 28, 6.7, 0.2, 0.4, "fridge", "🦐"),
  F("tuna", "Tuna (canned)", "oz", 42, 9, 0, 1, "pantry", "🐟"),
  F("greekyogurt", "Greek yogurt", "cup", 150, 23, 9, 0.7, "fridge", "🍶"),
  F("cottagecheese", "Cottage cheese", "cup", 190, 24, 7, 5, "fridge", "🧀"),
  F("stringcheese", "String cheese", "each", 80, 7, 1, 6, "fridge", "🧀"),
  F("cheese", "Cheddar cheese", "oz", 113, 7, 0.4, 9.3, "fridge", "🧀"),
  F("milk", "Milk (2%)", "cup", 122, 8, 12, 5, "fridge", "🥛"),
  F("proteinpowder", "Protein powder", "each", 120, 24, 3, 1.5, "pantry", "🥤"),
  F("proteinshake", "Protein shake", "each", 160, 30, 6, 3, "fridge", "🥤"),
  // Grains & starches
  F("oats", "Oats", "cup", 307, 10.7, 55, 5.3, "pantry", "🌾"),
  F("brownrice", "Brown rice (cooked)", "cup", 216, 5, 45, 1.8, "pantry", "🍚"),
  F("whiterice", "Jasmine rice (cooked)", "cup", 205, 4.3, 45, 0.4, "pantry", "🍚"),
  F("quinoa", "Quinoa (cooked)", "cup", 222, 8, 39, 3.6, "pantry", "🍚"),
  F("farro", "Farro (cooked)", "cup", 200, 7, 40, 1.5, "pantry", "🌾"),
  F("wwbread", "Whole-wheat bread", "each", 80, 4, 14, 1, "pantry", "🍞"),
  F("wrap", "Whole-wheat wrap", "each", 130, 4, 22, 3.5, "pantry", "🌯"),
  F("roll", "Whole-grain roll", "each", 120, 4, 22, 2, "pantry", "🍞"),
  F("crackers", "Whole-grain crackers", "each", 15, 0.3, 2.5, 0.5, "pantry", "🍘"),
  F("englishmuffin", "English muffin", "each", 130, 5, 25, 1, "pantry", "🍞"),
  F("granola", "Granola", "cup", 490, 11, 64, 24, "pantry", "🥣"),
  F("potato", "Baked potato", "each", 160, 4, 37, 0.2, "pantry", "🥔"),
  F("sweetpotato", "Sweet potato", "each", 160, 3.6, 37, 0.3, "pantry", "🍠"),
  F("blackbeans", "Black beans", "cup", 227, 15, 41, 0.9, "pantry", "🫘"),
  F("beans", "Beans (chili)", "cup", 225, 15, 40, 0.9, "pantry", "🫘"),
  // Nuts, oils & spreads
  F("peanutbutter", "Peanut butter", "tbsp", 96, 4, 3, 8, "pantry", "🥜"),
  F("almondbutter", "Almond butter", "tbsp", 98, 3.4, 3, 9, "pantry", "🥜"),
  F("almonds", "Almonds", "oz", 164, 6, 6, 14, "pantry", "🌰"),
  F("walnuts", "Walnuts", "oz", 185, 4.3, 3.9, 18.5, "pantry", "🌰"),
  F("mixednuts", "Mixed nuts", "oz", 173, 5, 6, 15, "pantry", "🥜"),
  F("trailmix", "Trail mix", "oz", 137, 4, 13, 9, "pantry", "🥜"),
  F("hummus", "Hummus", "tbsp", 25, 1, 2, 1.5, "fridge", "🥣"),
  F("oliveoil", "Olive oil", "tbsp", 119, 0, 0, 13.5, "pantry", "🫒"),
  F("sesameoil", "Sesame oil", "tbsp", 120, 0, 0, 13.6, "pantry", "🫗"),
  F("butter", "Butter", "tbsp", 102, 0.1, 0, 11.5, "fridge", "🧈"),
  F("vinaigrette", "Vinaigrette", "tbsp", 70, 0, 1, 7, "fridge", "🥗"),
  F("caesar", "Caesar dressing", "tbsp", 80, 0.5, 0.5, 8.5, "fridge", "🥗"),
  F("avocado", "Avocado", "each", 240, 3, 12, 22, "fridge", "🥑"),
  // Vegetables
  F("broccoli", "Broccoli", "cup", 31, 2.5, 6, 0.3, "fridge", "🥦"),
  F("spinach", "Spinach", "cup", 7, 0.9, 1.1, 0.1, "fridge", "🥬"),
  F("mushrooms", "Mushrooms", "cup", 15, 2.2, 2.3, 0.2, "fridge", "🍄"),
  F("peppers", "Bell peppers", "cup", 30, 1, 7, 0.3, "fridge", "🫑"),
  F("onion", "Onion", "cup", 64, 1.8, 15, 0.2, "fridge", "🧅"),
  F("carrots", "Carrots", "cup", 50, 1.2, 12, 0.3, "fridge", "🥕"),
  F("greens", "Mixed greens", "cup", 8, 0.5, 1.5, 0.1, "fridge", "🥬"),
  F("brussels", "Brussels sprouts", "cup", 38, 3, 8, 0.3, "fridge", "🥬"),
  F("greenbeans", "Green beans", "cup", 31, 1.8, 7, 0.1, "fridge", "🫛"),
  F("asparagus", "Asparagus", "cup", 27, 3, 5, 0.2, "fridge", "🥬"),
  F("tomatoes", "Tomatoes", "cup", 32, 1.6, 7, 0.4, "fridge", "🍅"),
  F("rootveg", "Root vegetables", "cup", 60, 1.5, 14, 0.2, "fridge", "🥕"),
  // Fruits
  F("banana", "Bananas", "each", 105, 1.3, 27, 0.4, "pantry", "🍌"),
  F("berries", "Mixed berries", "cup", 70, 1, 17, 0.5, "freezer", "🫐"),
  F("apple", "Apples", "each", 95, 0.5, 25, 0.3, "pantry", "🍎"),
  F("orange", "Oranges", "each", 62, 1.2, 15, 0.2, "pantry", "🍊"),
  F("grapes", "Grapes", "cup", 104, 1, 27, 0.2, "fridge", "🍇"),
  F("pineapple", "Pineapple", "cup", 82, 0.9, 22, 0.2, "fridge", "🍍"),
  F("fruitsalad", "Fruit salad", "cup", 75, 1, 19, 0.2, "fridge", "🍓"),
  F("oj", "Orange juice", "cup", 112, 2, 26, 0.5, "fridge", "🧃"),
  // Condiments & misc
  F("honey", "Honey", "tbsp", 64, 0, 17, 0, "pantry", "🍯"),
  F("salsa", "Salsa", "tbsp", 5, 0.2, 1, 0, "fridge", "🍅"),
  F("cinnamon", "Cinnamon", "tsp", 6, 0.1, 2, 0, "pantry", "🧂"),
  F("coffee", "Black coffee", "cup", 2, 0.3, 0, 0, "pantry", "☕"),
];

// Meal category from the recipe id suffix (mon-b → breakfast, tue-l → lunch, …).
const SUFFIX: Record<string, MealType> = { b: "breakfast", l: "lunch", s: "snack", d: "dinner", e: "extra" };

// Compact recipe builder. All meals are single-serving personal portions.
const R = (
  id: string, name: string, emoji: string,
  ings: [string, number][], steps: string[] = [],
): Recipe => ({
  id, name, emoji, servings: 1,
  ingredients: ings.map(([foodId, quantity]) => ({ foodId, quantity })),
  steps,
  category: SUFFIX[id.split("-").pop() ?? ""] ?? "breakfast",
});

const recipes: Recipe[] = [
  // Monday
  R("mon-b", "Egg Scramble & Oats", "🍳", [["egg", 3], ["eggwhite", 3], ["oats", 1], ["berries", 0.5], ["peanutbutter", 1], ["coffee", 1]], ["Scramble eggs and egg whites.", "Cook oats; top with berries and peanut butter.", "Serve with black coffee."]),
  R("mon-l", "Grilled Chicken & Brown Rice", "🍗", [["chicken", 8], ["brownrice", 1.5], ["broccoli", 2], ["oliveoil", 1]], ["Grill the chicken.", "Roast broccoli with olive oil.", "Serve over brown rice."]),
  R("mon-s", "Yogurt, Banana & Almonds", "🥣", [["greekyogurt", 1], ["banana", 1], ["almonds", 1]]),
  R("mon-d", "Baked Salmon & Sweet Potato", "🐟", [["salmon", 6], ["sweetpotato", 1], ["greens", 2], ["vinaigrette", 1]], ["Bake salmon.", "Bake sweet potato.", "Dress greens with vinaigrette."]),
  R("mon-e", "Cottage Cheese (bedtime)", "🧀", [["cottagecheese", 1]]),
  // Tuesday
  R("tue-b", "Greek Yogurt Parfait", "🍶", [["greekyogurt", 1.5], ["granola", 1.25], ["berries", 0.5]]),
  R("tue-l", "Turkey & Avocado Wrap", "🌯", [["wrap", 1], ["turkeydeli", 4], ["avocado", 0.5], ["carrots", 1], ["hummus", 2]]),
  R("tue-s", "Protein Shake & Apple", "🥤", [["proteinshake", 1], ["apple", 1]]),
  R("tue-d", "Beef Stir-Fry over Rice", "🥩", [["beef937", 8], ["peppers", 1], ["onion", 0.5], ["broccoli", 1], ["whiterice", 3]], ["Brown the beef.", "Stir-fry with peppers, onion, broccoli.", "Serve over jasmine rice."]),
  R("tue-e", "Handful of Walnuts", "🌰", [["walnuts", 1]]),
  // Wednesday
  R("wed-b", "Eggs, Avocado Toast & Orange", "🍳", [["egg", 4], ["wwbread", 2], ["avocado", 1.5], ["orange", 1]]),
  R("wed-l", "Tuna Salad & Roll", "🥗", [["tuna", 5], ["greekyogurt", 0.25], ["greens", 2], ["roll", 1], ["grapes", 1]], ["Mix tuna with Greek yogurt.", "Serve over greens with a roll and grapes."]),
  R("wed-s", "String Cheese, Crackers & Apple", "🧀", [["stringcheese", 1], ["crackers", 6], ["apple", 1]]),
  R("wed-d", "Chicken Thighs & Quinoa", "🍗", [["chickenthigh", 8], ["quinoa", 2.5], ["brussels", 1.5]], ["Grill chicken thighs.", "Roast Brussels sprouts.", "Serve with quinoa."]),
  R("wed-e", "Greek Yogurt w/ Honey", "🍯", [["greekyogurt", 1], ["honey", 1]]),
  // Thursday
  R("thu-b", "Protein Oatmeal", "🥣", [["oats", 1.25], ["proteinpowder", 1], ["banana", 1], ["cinnamon", 1], ["milk", 1]], ["Cook oats with milk.", "Stir in protein powder, banana and cinnamon."]),
  R("thu-l", "Turkey Chili & Side Salad", "🌶️", [["groundturkey", 9], ["beans", 2], ["tomatoes", 1], ["greens", 2]], ["Simmer turkey, beans and tomatoes into chili.", "Serve with a side salad."]),
  R("thu-s", "Cottage Cheese & Pineapple", "🍍", [["cottagecheese", 1], ["pineapple", 1]]),
  R("thu-d", "Baked Cod & Farro", "🐟", [["whitefish", 8], ["farro", 2.5], ["greenbeans", 1.5]], ["Bake the cod.", "Steam green beans.", "Serve with farro."]),
  R("thu-e", "Trail Mix", "🥜", [["trailmix", 1]]),
  // Friday
  R("fri-b", "Eggs, Turkey Sausage & Muffin", "🍳", [["egg", 3], ["turkeysausage", 2], ["englishmuffin", 1], ["oj", 0.5]]),
  R("fri-l", "Chicken Burrito Bowl", "🌯", [["chicken", 6], ["brownrice", 2], ["blackbeans", 1.5], ["salsa", 3], ["cheese", 1], ["greens", 1]]),
  R("fri-s", "Protein Shake & Almond Butter", "🥤", [["proteinshake", 1], ["almondbutter", 1]]),
  R("fri-d", "Sirloin, Baked Potato & Asparagus", "🥩", [["sirloin", 8], ["potato", 1], ["asparagus", 1.5], ["oliveoil", 1]], ["Sear the sirloin.", "Bake the potato.", "Roast asparagus in olive oil."]),
  R("fri-e", "Greek Yogurt", "🍶", [["greekyogurt", 1]]),
  // Saturday
  R("sat-b", "Protein Pancakes & Berries", "🥞", [["oats", 0.75], ["egg", 2], ["proteinpowder", 1], ["banana", 1], ["berries", 0.5]], ["Blend oats, eggs, protein powder and banana.", "Cook as pancakes; top with berries."]),
  R("sat-l", "Chicken Caesar Salad & Roll", "🥗", [["chicken", 10], ["greens", 3], ["caesar", 2], ["roll", 1]]),
  R("sat-s", "Apple & Peanut Butter", "🍎", [["apple", 1], ["peanutbutter", 2]]),
  R("sat-d", "Shrimp & Veggie Stir-Fry", "🦐", [["shrimp", 8], ["peppers", 1], ["broccoli", 1], ["whiterice", 3], ["sesameoil", 1]], ["Stir-fry shrimp with peppers and broccoli in sesame oil.", "Serve over rice."]),
  R("sat-e", "Mixed Nuts", "🥜", [["mixednuts", 1]]),
  // Sunday
  R("sun-b", "Veggie Omelet & Fruit", "🍳", [["egg", 4], ["spinach", 1], ["mushrooms", 1], ["peppers", 0.5], ["cheese", 1], ["fruitsalad", 1]]),
  R("sun-l", "Grilled Chicken & Roasted Veg", "🍗", [["chicken", 8], ["rootveg", 1.5], ["brownrice", 2]]),
  R("sun-s", "Greek Yogurt & Granola", "🥣", [["greekyogurt", 1], ["granola", 1.25]]),
  R("sun-d", "Roast Chicken & Root Veg", "🍗", [["chicken", 8], ["rootveg", 2], ["greens", 2]]),
  R("sun-e", "Cottage Cheese", "🧀", [["cottagecheese", 1]]),
];

// Which recipe fills each meal slot, per weekday (Monday = 0 … Sunday = 6).
const TEMPLATE: Record<number, Record<MealType, string>> = {
  0: { breakfast: "mon-b", lunch: "mon-l", snack: "mon-s", dinner: "mon-d", extra: "mon-e" },
  1: { breakfast: "tue-b", lunch: "tue-l", snack: "tue-s", dinner: "tue-d", extra: "tue-e" },
  2: { breakfast: "wed-b", lunch: "wed-l", snack: "wed-s", dinner: "wed-d", extra: "wed-e" },
  3: { breakfast: "thu-b", lunch: "thu-l", snack: "thu-s", dinner: "thu-d", extra: "thu-e" },
  4: { breakfast: "fri-b", lunch: "fri-l", snack: "fri-s", dinner: "fri-d", extra: "fri-e" },
  5: { breakfast: "sat-b", lunch: "sat-l", snack: "sat-s", dinner: "sat-d", extra: "sat-e" },
  6: { breakfast: "sun-b", lunch: "sun-l", snack: "sun-s", dinner: "sun-d", extra: "sun-e" },
};

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "snack", "dinner", "extra"];

/** Fill the whole current month (plus a week of padding) with the weekly template. */
function seedPlan(): PlannedMeal[] {
  const start = addDays(startOfMonth(new Date()), -7);
  const end = addDays(endOfMonth(new Date()), 7);
  const plan: PlannedMeal[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const iso = format(d, "yyyy-MM-dd");
    const dayTemplate = TEMPLATE[mondayIndex(d)];
    for (const mealType of MEAL_TYPES) {
      plan.push({
        id: `${iso}-${mealType}`,
        date: iso,
        mealType,
        recipeId: dayTemplate[mealType],
        servings: 1,
      });
    }
  }
  return plan;
}

// Stock a reasonable starting amount of everything, by unit.
const defaultStock: Record<Food["unit"], number> = {
  each: 8, cup: 6, tbsp: 16, tsp: 24, oz: 24,
};
const inventory = foods.map((f) => ({ foodId: f.id, quantity: defaultStock[f.unit] }));

export const seedData: AppData = {
  foods,
  recipes,
  inventory,
  plan: seedPlan(),
  manualGroceries: [],
  history: [],
  goals: {
    dailyCalorieTarget: 2900,
    proteinTarget: 180,
    carbsTarget: 330,
    fatTarget: 90,
  },
  profile: {
    label: "Active adult male",
    heightIn: 74,
    weightLb: 200,
    age: 25,
    activity: "Moderately active → active",
  },
};
