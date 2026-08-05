import { format, startOfWeek, addDays } from "date-fns";
import type { AppData, Food, Recipe } from "./types";

// Calories are per single US unit (per each / per cup / per tbsp / per tsp / per oz).
const foods: Food[] = [
  { id: "egg", name: "Eggs", unit: "each", caloriesPerUnit: 78, location: "fridge", emoji: "🥚" },
  { id: "milk", name: "Milk", unit: "cup", caloriesPerUnit: 149, location: "fridge", emoji: "🥛" },
  { id: "chicken", name: "Chicken breast", unit: "oz", caloriesPerUnit: 47, location: "fridge", emoji: "🍗" },
  { id: "spinach", name: "Spinach", unit: "cup", caloriesPerUnit: 7, location: "fridge", emoji: "🥬" },
  { id: "tomato", name: "Tomatoes", unit: "each", caloriesPerUnit: 22, location: "fridge", emoji: "🍅" },
  { id: "cheese", name: "Cheddar cheese", unit: "oz", caloriesPerUnit: 113, location: "fridge", emoji: "🧀" },
  { id: "yogurt", name: "Greek yogurt", unit: "cup", caloriesPerUnit: 150, location: "fridge", emoji: "🍶" },
  { id: "butter", name: "Butter", unit: "tbsp", caloriesPerUnit: 102, location: "fridge", emoji: "🧈" },
  { id: "rice", name: "Rice (cooked)", unit: "cup", caloriesPerUnit: 205, location: "pantry", emoji: "🍚" },
  { id: "oats", name: "Oats", unit: "cup", caloriesPerUnit: 307, location: "pantry", emoji: "🌾" },
  { id: "pasta", name: "Pasta (cooked)", unit: "cup", caloriesPerUnit: 221, location: "pantry", emoji: "🍝" },
  { id: "oliveoil", name: "Olive oil", unit: "tbsp", caloriesPerUnit: 119, location: "pantry", emoji: "🫒" },
  { id: "banana", name: "Bananas", unit: "each", caloriesPerUnit: 105, location: "pantry", emoji: "🍌" },
  { id: "bread", name: "Bread", unit: "each", caloriesPerUnit: 80, location: "pantry", emoji: "🍞" },
  { id: "honey", name: "Honey", unit: "tbsp", caloriesPerUnit: 64, location: "pantry", emoji: "🍯" },
  { id: "berries", name: "Mixed berries", unit: "cup", caloriesPerUnit: 70, location: "freezer", emoji: "🫐" },
];

const recipes: Recipe[] = [
  {
    id: "veggie-omelette",
    name: "Spinach & Cheese Omelette",
    servings: 1,
    emoji: "🍳",
    ingredients: [
      { foodId: "egg", quantity: 3 },
      { foodId: "spinach", quantity: 1 },
      { foodId: "cheese", quantity: 1 },
      { foodId: "butter", quantity: 1 },
    ],
    steps: [
      "Whisk the eggs with a pinch of salt.",
      "Melt butter in a pan over medium heat.",
      "Add eggs, then spinach and cheese as they set.",
      "Fold and serve.",
    ],
  },
  {
    id: "overnight-oats",
    name: "Berry Overnight Oats",
    servings: 1,
    emoji: "🥣",
    ingredients: [
      { foodId: "oats", quantity: 0.5 },
      { foodId: "milk", quantity: 0.75 },
      { foodId: "yogurt", quantity: 0.5 },
      { foodId: "berries", quantity: 0.5 },
      { foodId: "honey", quantity: 1 },
    ],
    steps: [
      "Combine oats, milk and yogurt in a jar.",
      "Top with berries and a drizzle of honey.",
      "Refrigerate overnight.",
    ],
  },
  {
    id: "chicken-rice",
    name: "Chicken & Rice Bowl",
    servings: 2,
    emoji: "🍛",
    ingredients: [
      { foodId: "chicken", quantity: 10 },
      { foodId: "rice", quantity: 1.5 },
      { foodId: "spinach", quantity: 2 },
      { foodId: "oliveoil", quantity: 1 },
    ],
    steps: [
      "Cook rice according to package.",
      "Pan-sear seasoned chicken in olive oil until cooked through.",
      "Wilt spinach, slice chicken, and serve over rice.",
    ],
  },
  {
    id: "tomato-pasta",
    name: "Cheesy Tomato Pasta",
    servings: 2,
    emoji: "🍝",
    ingredients: [
      { foodId: "pasta", quantity: 2 },
      { foodId: "tomato", quantity: 4 },
      { foodId: "cheese", quantity: 1.5 },
      { foodId: "oliveoil", quantity: 1 },
    ],
    steps: [
      "Boil pasta until al dente.",
      "Simmer chopped tomatoes in olive oil to make a quick sauce.",
      "Toss pasta with sauce and top with cheese.",
    ],
  },
  {
    id: "banana-toast",
    name: "Honey Banana Toast",
    servings: 1,
    emoji: "🍞",
    ingredients: [
      { foodId: "bread", quantity: 2 },
      { foodId: "banana", quantity: 1 },
      { foodId: "honey", quantity: 1 },
      { foodId: "butter", quantity: 0.5 },
    ],
    steps: [
      "Toast and butter the bread.",
      "Top with sliced banana and a drizzle of honey.",
    ],
  },
];

// Current stock, in each food's US unit.
const inventory = [
  { foodId: "egg", quantity: 12 },
  { foodId: "milk", quantity: 4 },
  { foodId: "chicken", quantity: 16 },
  { foodId: "spinach", quantity: 4 },
  { foodId: "tomato", quantity: 6 },
  { foodId: "cheese", quantity: 8 },
  { foodId: "yogurt", quantity: 4 },
  { foodId: "butter", quantity: 8 },
  { foodId: "rice", quantity: 6 },
  { foodId: "oats", quantity: 5 },
  { foodId: "pasta", quantity: 4 },
  { foodId: "oliveoil", quantity: 16 },
  { foodId: "banana", quantity: 5 },
  { foodId: "bread", quantity: 10 },
  { foodId: "honey", quantity: 12 },
  { foodId: "berries", quantity: 3 },
];

/** Build a starter weekly plan anchored to the current week. */
function seedPlan() {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const d = (offset: number) => format(addDays(weekStart, offset), "yyyy-MM-dd");
  return [
    { id: "p1", date: d(0), mealType: "breakfast" as const, recipeId: "overnight-oats", servings: 1 },
    { id: "p2", date: d(0), mealType: "dinner" as const, recipeId: "chicken-rice", servings: 2 },
    { id: "p3", date: d(1), mealType: "breakfast" as const, recipeId: "veggie-omelette", servings: 1 },
    { id: "p4", date: d(1), mealType: "dinner" as const, recipeId: "tomato-pasta", servings: 2 },
    { id: "p5", date: d(2), mealType: "breakfast" as const, recipeId: "banana-toast", servings: 1 },
    { id: "p6", date: d(3), mealType: "dinner" as const, recipeId: "chicken-rice", servings: 2 },
    { id: "p7", date: d(4), mealType: "breakfast" as const, recipeId: "overnight-oats", servings: 1 },
  ];
}

export const seedData: AppData = {
  foods,
  recipes,
  inventory,
  plan: seedPlan(),
  manualGroceries: [],
  goals: { dailyCalorieTarget: 2000 },
};
