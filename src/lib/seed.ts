import { startOfMonth, endOfMonth, addDays, format } from "date-fns";
import type { AppData, Food, FoodCategory, Recipe, MealType, PlannedMeal, Price } from "./types";
import { BASE_STORE_ID, BEST_STORE_ID } from "./cost";
import { mondayIndex } from "./week";

// Which food-type bucket each food id belongs to (groups the Kitchen).
const CATS: Record<FoodCategory, string[]> = {
  protein: ["egg", "eggwhite", "chicken", "chickenthigh", "salmon", "whitefish", "beef937", "groundbeef80", "sirloin", "groundturkey", "turkeydeli", "turkeysausage", "shrimp", "tuna", "tofu", "proteinpowder", "proteinshake"],
  dairy: ["greekyogurt", "cottagecheese", "stringcheese", "cheese", "milk", "oatmilk", "boursin", "mozzarellaballs"],
  grain: ["oats", "brownrice", "whiterice", "jasminerice", "quinoa", "farro", "wwbread", "wrap", "roll", "crackers", "englishmuffin", "granola", "corntortillas", "spaghetti", "panko"],
  starch: ["potato", "sweetpotato"],
  legume: ["blackbeans", "beans", "hummus"],
  nut: ["peanutbutter", "almondbutter", "almonds", "walnuts", "mixednuts", "trailmix"],
  fat: ["oliveoil", "sesameoil", "butter", "avocado"],
  vegetable: ["broccoli", "spinach", "mushrooms", "peppers", "onion", "shallot", "carrots", "greens", "brussels", "greenbeans", "asparagus", "tomatoes", "rootveg", "arugula", "garlic", "crushedtomatoes"],
  fruit: ["banana", "berries", "apple", "orange", "grapes", "pineapple", "fruitsalad", "oj", "blueberries", "frozenstrawberries"],
  // Dressings sit here rather than under fats: they live in the door with the
  // other jars, and you reach for them the way you reach for salsa.
  condiment: ["honey", "salsa", "coffee", "yangnyeom", "vinaigrette", "caesar", "soysauce", "dijon", "ketchup"],
  // Anything you measure in teaspoons for flavour — jarred or fresh-cut.
  spice: [
    "salt", "blackpepper", "cinnamon", "garlicpowder", "onionpowder", "paprika",
    "cumin", "chiliflakes", "oregano", "italianseasoning", "turmeric", "bayleaf",
    "vanilla", "basil", "cilantro", "parsley", "ginger",
  ]
};
const CAT_OF: Record<string, FoodCategory> = {};
(Object.keys(CATS) as FoodCategory[]).forEach((c) => CATS[c].forEach((id) => (CAT_OF[id] = c)));

// Compact food builder: id, name, unit, calories, protein, carbs, fat, location.
type Loc = Food["location"];
type U = Food["unit"];
const F = (
  id: string, name: string, unit: U, cal: number,
  protein: number, carbs: number, fat: number, location: Loc,
): Food => ({ id, name, unit, caloriesPerUnit: cal, protein, carbs, fat, location, category: CAT_OF[id] ?? "condiment" });

const foods: Food[] = [
  // Proteins & dairy
  F("egg", "Eggs", "each", 78, 6.3, 0.6, 5.3, "fridge"),
  F("eggwhite", "Egg whites", "each", 17, 3.6, 0.2, 0.1, "fridge"),
  F("chicken", "Chicken breast", "oz", 47, 8.8, 0, 1.0, "fridge"),
  F("chickenthigh", "Chicken thigh", "oz", 59, 7.5, 0, 3.1, "fridge"),
  F("salmon", "Salmon", "oz", 58, 6.3, 0, 3.4, "fridge"),
  F("whitefish", "White fish (cod/tilapia)", "oz", 33, 6.8, 0, 0.7, "fridge"),
  F("beef937", "Ground beef 93/7", "oz", 51, 7.5, 0, 2.2, "fridge"),
  F("sirloin", "Sirloin steak", "oz", 57, 8.6, 0, 2.3, "fridge"),
  F("groundturkey", "Ground turkey", "oz", 50, 7.0, 0, 2.4, "fridge"),
  F("turkeydeli", "Turkey (deli)", "oz", 30, 5.0, 1, 0.6, "fridge"),
  F("turkeysausage", "Turkey sausage", "each", 65, 6, 1, 4, "fridge"),
  F("shrimp", "Shrimp", "oz", 28, 6.7, 0.2, 0.4, "fridge"),
  F("tuna", "Tuna (canned)", "oz", 42, 9, 0, 1, "pantry"),
  F("greekyogurt", "Greek yogurt", "cup", 150, 23, 9, 0.7, "fridge"),
  F("cottagecheese", "Cottage cheese", "cup", 190, 24, 7, 5, "fridge"),
  F("stringcheese", "String cheese", "each", 80, 7, 1, 6, "fridge"),
  F("cheese", "Cheddar cheese", "oz", 113, 7, 0.4, 9.3, "fridge"),
  F("milk", "Milk (2%)", "cup", 122, 8, 12, 5, "fridge"),
  F("proteinpowder", "Protein powder", "each", 120, 24, 3, 1.5, "pantry"),
  F("proteinshake", "Protein shake", "each", 160, 30, 6, 3, "fridge"),
  // Grains & starches
  F("oats", "Oats", "cup", 307, 10.7, 55, 5.3, "pantry"),
  F("brownrice", "Brown rice (cooked)", "cup", 216, 5, 45, 1.8, "pantry"),
  F("whiterice", "Jasmine rice (cooked)", "cup", 205, 4.3, 45, 0.4, "pantry"),
  F("quinoa", "Quinoa (cooked)", "cup", 222, 8, 39, 3.6, "pantry"),
  F("farro", "Farro (cooked)", "cup", 200, 7, 40, 1.5, "pantry"),
  F("wwbread", "Whole-wheat bread", "each", 80, 4, 14, 1, "pantry"),
  F("wrap", "Whole-wheat wrap", "each", 130, 4, 22, 3.5, "pantry"),
  F("roll", "Whole-grain roll", "each", 120, 4, 22, 2, "pantry"),
  F("crackers", "Whole-grain crackers", "each", 15, 0.3, 2.5, 0.5, "pantry"),
  F("englishmuffin", "English muffin", "each", 130, 5, 25, 1, "pantry"),
  F("granola", "Granola", "cup", 490, 11, 64, 24, "pantry"),
  F("potato", "Baked potato", "each", 160, 4, 37, 0.2, "pantry"),
  F("sweetpotato", "Sweet potato", "each", 160, 3.6, 37, 0.3, "pantry"),
  F("blackbeans", "Black beans", "cup", 227, 15, 41, 0.9, "pantry"),
  F("beans", "Beans (chili)", "cup", 225, 15, 40, 0.9, "pantry"),
  // Nuts, oils & spreads
  F("peanutbutter", "Peanut butter", "tbsp", 96, 4, 3, 8, "pantry"),
  F("almondbutter", "Almond butter", "tbsp", 98, 3.4, 3, 9, "pantry"),
  F("almonds", "Almonds", "oz", 164, 6, 6, 14, "pantry"),
  F("walnuts", "Walnuts", "oz", 185, 4.3, 3.9, 18.5, "pantry"),
  F("mixednuts", "Mixed nuts", "oz", 173, 5, 6, 15, "pantry"),
  F("trailmix", "Trail mix", "oz", 137, 4, 13, 9, "pantry"),
  F("hummus", "Hummus", "tbsp", 25, 1, 2, 1.5, "fridge"),
  F("oliveoil", "Olive oil", "tbsp", 119, 0, 0, 13.5, "pantry"),
  F("sesameoil", "Sesame oil", "tbsp", 120, 0, 0, 13.6, "pantry"),
  F("butter", "Butter", "tbsp", 102, 0.1, 0, 11.5, "fridge"),
  F("vinaigrette", "Vinaigrette", "tbsp", 70, 0, 1, 7, "fridge"),
  F("caesar", "Caesar dressing", "tbsp", 80, 0.5, 0.5, 8.5, "fridge"),
  F("avocado", "Avocado", "each", 240, 3, 12, 22, "fridge"),
  // Vegetables
  F("broccoli", "Broccoli", "cup", 31, 2.5, 6, 0.3, "fridge"),
  F("spinach", "Spinach", "cup", 7, 0.9, 1.1, 0.1, "fridge"),
  F("mushrooms", "Mushrooms", "cup", 15, 2.2, 2.3, 0.2, "fridge"),
  F("peppers", "Bell peppers", "cup", 30, 1, 7, 0.3, "fridge"),
  F("onion", "Onion", "cup", 64, 1.8, 15, 0.2, "pantry"),
  F("carrots", "Carrots", "cup", 50, 1.2, 12, 0.3, "fridge"),
  F("greens", "Mixed greens", "cup", 8, 0.5, 1.5, 0.1, "fridge"),
  F("brussels", "Brussels sprouts", "cup", 38, 3, 8, 0.3, "fridge"),
  F("greenbeans", "Green beans", "cup", 31, 1.8, 7, 0.1, "fridge"),
  F("asparagus", "Asparagus", "cup", 27, 3, 5, 0.2, "fridge"),
  F("tomatoes", "Tomatoes", "cup", 32, 1.6, 7, 0.4, "fridge"),
  F("rootveg", "Root vegetables", "cup", 60, 1.5, 14, 0.2, "fridge"),
  // Fruits
  F("banana", "Bananas", "each", 105, 1.3, 27, 0.4, "pantry"),
  F("berries", "Mixed berries", "cup", 70, 1, 17, 0.5, "freezer"),
  F("apple", "Apples", "each", 95, 0.5, 25, 0.3, "pantry"),
  F("orange", "Oranges", "each", 62, 1.2, 15, 0.2, "pantry"),
  F("grapes", "Grapes", "cup", 104, 1, 27, 0.2, "fridge"),
  F("pineapple", "Pineapple", "cup", 82, 0.9, 22, 0.2, "fridge"),
  F("fruitsalad", "Fruit salad", "cup", 75, 1, 19, 0.2, "fridge"),
  F("oj", "Orange juice", "cup", 112, 2, 26, 0.5, "fridge"),
  // Condiments & misc
  F("honey", "Honey", "tbsp", 64, 0, 17, 0, "pantry"),
  F("salsa", "Salsa", "tbsp", 5, 0.2, 1, 0, "fridge"),
  F("cinnamon", "Cinnamon", "tsp", 6, 0.1, 2, 0, "pantry"),
  F("coffee", "Black coffee", "cup", 2, 0.3, 0, 0, "pantry"),
  // Added from the Trader Joe's receipt
  F("groundbeef80", "Ground beef 80/20", "oz", 71, 6.7, 0, 4.9, "fridge"),

  // Boursin pasta with meatballs
  F("spaghetti", "Spaghetti (dry)", "oz", 105, 3.7, 21.3, 0.4, "pantry"),
  F("panko", "Panko breadcrumbs", "cup", 220, 7, 40, 3, "pantry"),
  F("boursin", "Boursin cheese", "oz", 120, 2, 1, 13, "fridge"),
  F("crushedtomatoes", "Crushed tomatoes (canned)", "oz", 9, 0.5, 2, 0.1, "pantry"),
  F("mozzarellaballs", "Mozzarella balls", "each", 42, 2.7, 0.3, 3.2, "fridge"),
  F("salt", "Salt", "tsp", 0, 0, 0, 0, "pantry"),
  F("blackpepper", "Black pepper", "tsp", 6, 0.2, 1.5, 0.1, "pantry"),
  F("tofu", "Tofu (firm)", "oz", 20, 2.3, 0.6, 1.2, "fridge"),
  F("oatmilk", "Oat milk", "cup", 120, 3, 16, 5, "fridge"),
  F("jasminerice", "Jasmine rice", "oz", 100, 2, 22, 0.2, "pantry"),
  F("corntortillas", "Corn tortillas", "each", 60, 1.5, 12, 0.7, "pantry"),
  F("arugula", "Arugula", "cup", 5, 0.5, 0.7, 0.1, "fridge"),
  F("garlic", "Garlic", "each", 4, 0.2, 1, 0, "pantry"),
  F("blueberries", "Blueberries", "cup", 84, 1.1, 21, 0.5, "fridge"),
  F("yangnyeom", "Yangnyeom sauce", "tbsp", 30, 0, 7, 0, "pantry"),
  F("frozenstrawberries", "Frozen strawberries", "cup", 50, 1, 12, 0.3, "freezer"),
  F("shallot", "Shallots", "each", 20, 0.7, 4.7, 0, "pantry"),

  // The spice rack: dried jars in the pantry, cut herbs in the fridge.
  F("garlicpowder", "Garlic powder", "tsp", 10, 0.5, 2.2, 0, "pantry"),
  F("onionpowder", "Onion powder", "tsp", 8, 0.2, 1.9, 0, "pantry"),
  F("paprika", "Paprika", "tsp", 6, 0.3, 1.2, 0.3, "pantry"),
  F("cumin", "Ground cumin", "tsp", 8, 0.4, 0.9, 0.5, "pantry"),
  F("chiliflakes", "Red chili flakes", "tsp", 6, 0.2, 1, 0.3, "pantry"),
  F("oregano", "Dried oregano", "tsp", 3, 0.1, 0.7, 0.1, "pantry"),
  F("italianseasoning", "Italian seasoning", "tsp", 4, 0.1, 0.8, 0.1, "pantry"),
  F("turmeric", "Turmeric", "tsp", 9, 0.3, 2, 0.1, "pantry"),
  F("bayleaf", "Bay leaves", "each", 2, 0.1, 0.5, 0.1, "pantry"),
  F("vanilla", "Vanilla extract", "tsp", 12, 0, 0.5, 0, "pantry"),
  F("basil", "Fresh basil", "tbsp", 1, 0.1, 0.1, 0, "fridge"),
  F("cilantro", "Fresh cilantro", "tbsp", 1, 0.1, 0.1, 0, "fridge"),
  F("parsley", "Fresh parsley", "tbsp", 1, 0.1, 0.2, 0, "fridge"),
  F("ginger", "Fresh ginger", "tsp", 2, 0, 0.4, 0, "fridge"),

  // Door-bin staples that were missing.
  F("soysauce", "Soy sauce", "tbsp", 8, 1.3, 0.8, 0, "fridge"),
  F("dijon", "Dijon mustard", "tsp", 5, 0.3, 0.3, 0.3, "fridge"),
  F("ketchup", "Ketchup", "tbsp", 17, 0.2, 4.5, 0, "fridge"),
];

// Meal category from the recipe id suffix (mon-b → breakfast, tue-l → lunch, …).
const SUFFIX: Record<string, MealType> = { b: "breakfast", l: "lunch", s: "snack", d: "dinner", e: "extra" };

// Compact recipe builder. All meals are single-serving personal portions.
const R = (
  id: string, name: string,
  ings: [string, number][], steps: string[] = [],
): Recipe => ({
  id, name, servings: 1,
  ingredients: ings.map(([foodId, quantity]) => ({ foodId, quantity })),
  steps,
  category: SUFFIX[id.split("-").pop() ?? ""] ?? "breakfast"
});

const recipes: Recipe[] = [
  // Monday
  R("mon-b", "Egg Scramble & Oats", [["egg", 3], ["eggwhite", 3], ["oats", 1], ["berries", 0.5], ["peanutbutter", 1], ["coffee", 1]], ["Scramble eggs and egg whites.", "Cook oats; top with berries and peanut butter.", "Serve with black coffee."]),
  R("mon-l", "Grilled Chicken & Brown Rice", [["chicken", 8], ["brownrice", 1.5], ["broccoli", 2], ["oliveoil", 1]], ["Grill the chicken.", "Roast broccoli with olive oil.", "Serve over brown rice."]),
  R("mon-s", "Yogurt, Banana & Almonds", [["greekyogurt", 1], ["banana", 1], ["almonds", 1]]),
  R("mon-d", "Baked Salmon & Sweet Potato", [["salmon", 6], ["sweetpotato", 1], ["greens", 2], ["vinaigrette", 1]], ["Bake salmon.", "Bake sweet potato.", "Dress greens with vinaigrette."]),
  R("mon-e", "Cottage Cheese (bedtime)", [["cottagecheese", 1]]),
  // Tuesday
  R("tue-b", "Greek Yogurt Parfait", [["greekyogurt", 1.5], ["granola", 1.25], ["berries", 0.5]]),
  R("tue-l", "Turkey & Avocado Wrap", [["wrap", 1], ["turkeydeli", 4], ["avocado", 0.5], ["carrots", 1], ["hummus", 2]]),
  R("tue-s", "Protein Shake & Apple", [["proteinshake", 1], ["apple", 1]]),
  R("tue-d", "Beef Stir-Fry over Rice", [["beef937", 8], ["peppers", 1], ["onion", 0.5], ["broccoli", 1], ["whiterice", 3]], ["Brown the beef.", "Stir-fry with peppers, onion, broccoli.", "Serve over jasmine rice."]),
  R("tue-e", "Handful of Walnuts", [["walnuts", 1]]),
  // Wednesday
  R("wed-b", "Eggs, Avocado Toast & Orange", [["egg", 4], ["wwbread", 2], ["avocado", 1.5], ["orange", 1]]),
  R("wed-l", "Tuna Salad & Roll", [["tuna", 5], ["greekyogurt", 0.25], ["greens", 2], ["roll", 1], ["grapes", 1]], ["Mix tuna with Greek yogurt.", "Serve over greens with a roll and grapes."]),
  R("wed-s", "String Cheese, Crackers & Apple", [["stringcheese", 1], ["crackers", 6], ["apple", 1]]),
  R("wed-d", "Chicken Thighs & Quinoa", [["chickenthigh", 8], ["quinoa", 2.5], ["brussels", 1.5]], ["Grill chicken thighs.", "Roast Brussels sprouts.", "Serve with quinoa."]),
  R("wed-e", "Greek Yogurt w/ Honey", [["greekyogurt", 1], ["honey", 1]]),
  // Thursday
  R("thu-b", "Protein Oatmeal", [["oats", 1.25], ["proteinpowder", 1], ["banana", 1], ["cinnamon", 1], ["milk", 1]], ["Cook oats with milk.", "Stir in protein powder, banana and cinnamon."]),
  R("thu-l", "Turkey Chili & Side Salad", [["groundturkey", 9], ["beans", 2], ["tomatoes", 1], ["greens", 2]], ["Simmer turkey, beans and tomatoes into chili.", "Serve with a side salad."]),
  R("thu-s", "Cottage Cheese & Pineapple", [["cottagecheese", 1], ["pineapple", 1]]),
  R("thu-d", "Baked Cod & Farro", [["whitefish", 8], ["farro", 2.5], ["greenbeans", 1.5]], ["Bake the cod.", "Steam green beans.", "Serve with farro."]),
  R("thu-e", "Trail Mix", [["trailmix", 1]]),
  // Friday
  R("fri-b", "Eggs, Turkey Sausage & Muffin", [["egg", 3], ["turkeysausage", 2], ["englishmuffin", 1], ["oj", 0.5]]),
  R("fri-l", "Chicken Burrito Bowl", [["chicken", 6], ["brownrice", 2], ["blackbeans", 1.5], ["salsa", 3], ["cheese", 1], ["greens", 1]]),
  R("fri-s", "Protein Shake & Almond Butter", [["proteinshake", 1], ["almondbutter", 1]]),
  R("fri-d", "Sirloin, Baked Potato & Asparagus", [["sirloin", 8], ["potato", 1], ["asparagus", 1.5], ["oliveoil", 1]], ["Sear the sirloin.", "Bake the potato.", "Roast asparagus in olive oil."]),
  R("fri-e", "Greek Yogurt", [["greekyogurt", 1]]),
  // Saturday
  R("sat-b", "Protein Pancakes & Berries", [["oats", 0.75], ["egg", 2], ["proteinpowder", 1], ["banana", 1], ["berries", 0.5]], ["Blend oats, eggs, protein powder and banana.", "Cook as pancakes; top with berries."]),
  R("sat-l", "Chicken Caesar Salad & Roll", [["chicken", 10], ["greens", 3], ["caesar", 2], ["roll", 1]]),
  R("sat-s", "Apple & Peanut Butter", [["apple", 1], ["peanutbutter", 2]]),
  R("sat-d", "Shrimp & Veggie Stir-Fry", [["shrimp", 8], ["peppers", 1], ["broccoli", 1], ["whiterice", 3], ["sesameoil", 1]], ["Stir-fry shrimp with peppers and broccoli in sesame oil.", "Serve over rice."]),
  R("sat-e", "Mixed Nuts", [["mixednuts", 1]]),
  // Sunday
  R("sun-b", "Veggie Omelet & Fruit", [["egg", 4], ["spinach", 1], ["mushrooms", 1], ["peppers", 0.5], ["cheese", 1], ["fruitsalad", 1]]),
  R("sun-l", "Grilled Chicken & Roasted Veg", [["chicken", 8], ["rootveg", 1.5], ["brownrice", 2]]),
  R("sun-s", "Greek Yogurt & Granola", [["greekyogurt", 1], ["granola", 1.25]]),
  R("sun-d", "Roast Chicken & Root Veg", [["chicken", 8], ["rootveg", 2], ["greens", 2]]),
  R("sun-e", "Cottage Cheese", [["cottagecheese", 1]]),
  // Restored favorites (single-serving)
  R("overnight-oats", "Berry Overnight Oats", [["oats", 0.5], ["oatmilk", 0.75], ["berries", 0.5], ["honey", 1]], ["Combine oats and oat milk in a jar.", "Top with berries and a drizzle of honey.", "Refrigerate overnight."]),
  R("corn-egg-breakfast", "Corn Tortilla & Egg Breakfast", [["corntortillas", 2], ["egg", 2], ["cheese", 1]], ["Scramble the eggs.", "Warm the corn tortillas.", "Fill with egg and cheese."]),
  // A four-serving dinner, so it is written out rather than built by R().
  {
    id: "boursin-pasta-meatballs",
    name: "Boursin Pasta with Meatballs",
    servings: 4,
    category: "dinner",
    ingredients: [
      { foodId: "spaghetti", quantity: 16 },        // 1 lb
      { foodId: "groundbeef80", quantity: 16 },     // 1 lb ground meat
      { foodId: "panko", quantity: 0.5 },
      { foodId: "egg", quantity: 1 },
      { foodId: "boursin", quantity: 5.2 },         // one 5.2 oz container
      { foodId: "crushedtomatoes", quantity: 28 },
      { foodId: "butter", quantity: 2 },
      { foodId: "mozzarellaballs", quantity: 8 },
      { foodId: "salt", quantity: 1 },
      { foodId: "blackpepper", quantity: 0.5 },
    ],
    steps: [
      "Mix ground meat, panko, egg, half the salt, half the pepper. Roll into 1.5-inch meatballs (~12-16).",
      "Melt butter in a large skillet over medium-high heat. Sear meatballs on all sides until browned.",
      "Boil spaghetti in salted water until al dente. Reserve 1 cup pasta water, then drain.",
      "Add canned tomatoes and remaining salt/pepper to the skillet with meatballs. Simmer until meatballs are cooked through.",
      "Lower heat, stir in Boursin until melted and creamy. Add pasta water if too thick.",
      "Add mozzarella balls, stir gently until softened.",
      "Toss in drained spaghetti, coat well, plate with meatballs and mozzarella on top.",
    ]
  },
];

// Which recipe fills each meal slot, per weekday (Monday = 0 … Sunday = 6).
const TEMPLATE: Record<number, Record<MealType, string>> = {
  0: { breakfast: "mon-b", lunch: "mon-l", snack: "mon-s", dinner: "mon-d", extra: "mon-e" },
  1: { breakfast: "tue-b", lunch: "tue-l", snack: "tue-s", dinner: "tue-d", extra: "tue-e" },
  2: { breakfast: "wed-b", lunch: "wed-l", snack: "wed-s", dinner: "wed-d", extra: "wed-e" },
  3: { breakfast: "thu-b", lunch: "thu-l", snack: "thu-s", dinner: "thu-d", extra: "thu-e" },
  4: { breakfast: "fri-b", lunch: "fri-l", snack: "fri-s", dinner: "fri-d", extra: "fri-e" },
  5: { breakfast: "sat-b", lunch: "sat-l", snack: "sat-s", dinner: "sat-d", extra: "sat-e" },
  6: { breakfast: "sun-b", lunch: "sun-l", snack: "sun-s", dinner: "sun-d", extra: "sun-e" }
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
        servings: 1
      });
    }
  }
  return plan;
}

// Stock reflects the latest Trader Joe's receipt — everything else starts empty.
const RECEIPT_STOCK: Record<string, number> = {
  chickenthigh: 20, egg: 12, cheese: 8, carrots: 3, onion: 1.5, apple: 3,
  banana: 7, spinach: 8, sweetpotato: 1, groundbeef80: 32, jasminerice: 32,
  oatmilk: 4, tofu: 14, corntortillas: 12, arugula: 5, garlic: 1,
  blueberries: 2, yangnyeom: 16, frozenstrawberries: 2
};
const inventory = foods.map((f) => ({ foodId: f.id, quantity: RECEIPT_STOCK[f.id] ?? 0 }));

// Typical US grocery prices, in dollars per one of the food's OWN unit (chicken
// per oz, milk per cup, olive oil per tbsp). These seed the BASE price row —
// the fallback used for any store the user hasn't priced individually — and are
// meant to be edited in the Costs tab to match what you actually pay.
const BASE_PRICE: Record<string, number> = {
  // Protein (per oz unless noted)
  chicken: 0.28, chickenthigh: 0.22, salmon: 0.75, whitefish: 0.56,
  beef937: 0.44, groundbeef80: 0.34, sirloin: 0.69, groundturkey: 0.31,
  turkeydeli: 0.62, shrimp: 0.69, tuna: 0.42, tofu: 0.16, cheese: 0.38,
  egg: 0.32, eggwhite: 0.22, stringcheese: 0.45, turkeysausage: 0.75,
  proteinpowder: 1.1, proteinshake: 2.6,
  // Dairy & drinks (per cup)
  greekyogurt: 1.45, cottagecheese: 1.2, milk: 0.28, oatmilk: 0.45,
  oj: 0.55, coffee: 0.25,
  // Grains & starch
  oats: 0.55, brownrice: 0.45, whiterice: 0.35, quinoa: 0.95, farro: 0.85,
  granola: 1.3, jasminerice: 0.09, wwbread: 0.22, wrap: 0.55, roll: 0.6,
  crackers: 0.06, englishmuffin: 0.6, corntortillas: 0.14,
  potato: 0.85, sweetpotato: 0.95, spaghetti: 0.12, panko: 0.9,
  // Boursin pasta additions
  boursin: 1.15, crushedtomatoes: 0.08, mozzarellaballs: 0.55,
  // Legumes & nuts
  blackbeans: 0.85, beans: 0.9, hummus: 0.22, peanutbutter: 0.18,
  almondbutter: 0.42, almonds: 0.62, walnuts: 0.75, mixednuts: 0.7, trailmix: 0.55,
  // Fats & dressings
  oliveoil: 0.3, sesameoil: 0.55, butter: 0.16, avocado: 1.35,
  vinaigrette: 0.2, caesar: 0.24,
  // Vegetables (per cup)
  broccoli: 0.75, spinach: 0.6, mushrooms: 0.9, peppers: 1.1, onion: 0.5,
  carrots: 0.45, greens: 1.1, brussels: 0.95, greenbeans: 0.7, asparagus: 1.4,
  tomatoes: 0.95, rootveg: 0.7, arugula: 1.2, garlic: 0.1,
  // Fruit
  banana: 0.3, berries: 2.2, apple: 0.85, orange: 0.8, grapes: 1.3,
  pineapple: 1.15, fruitsalad: 1.8, blueberries: 2.4, frozenstrawberries: 0.95,
  // Condiments
  honey: 0.28, salsa: 0.15, yangnyeom: 0.35, soysauce: 0.09, dijon: 0.05,
  ketchup: 0.08,
  // Spices & herbs — a jar's worth spread over the teaspoons it holds.
  salt: 0.01, blackpepper: 0.09, cinnamon: 0.09, garlicpowder: 0.08,
  onionpowder: 0.08, paprika: 0.09, cumin: 0.10, chiliflakes: 0.09,
  oregano: 0.10, italianseasoning: 0.09, turmeric: 0.10, bayleaf: 0.06,
  vanilla: 0.55, basil: 0.25, cilantro: 0.12, parsley: 0.12, ginger: 0.10,
  shallot: 0.65
};

const SEED_PRICED_ON = "2026-09-01";

const prices: Price[] = foods
  .filter((f) => BASE_PRICE[f.id] != null)
  .map((f) => ({
    storeId: BASE_STORE_ID,
    foodId: f.id,
    pricePerUnit: BASE_PRICE[f.id],
    updatedAt: SEED_PRICED_ON
  }));

export const seedData: AppData = {
  foods,
  recipes,
  inventory,
  plan: seedPlan(),
  events: [],
  manualGroceries: [],
  history: [],
  // Stores start empty on purpose: the Stores tab finds real ones near you
  // (or you add your own) rather than shipping made-up addresses.
  stores: [],
  prices,
  priceQuotes: [],
  selectedStoreId: BEST_STORE_ID,
  home: { city: "", state: "", zip: "" },
  goals: {
    dailyCalorieTarget: 2900,
    proteinTarget: 180,
    carbsTarget: 330,
    fatTarget: 90
  },
  profile: {
    label: "Active adult male",
    heightIn: 74,
    weightLb: 200,
    age: 25,
    activity: "Moderately active → active",
    birthDate: "2001-01-01",
    sex: "male"
  },
  focusAreas: ["athletic", "health"],
  householdMode: "individual",
  members: []
};
