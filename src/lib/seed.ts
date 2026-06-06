import { format, startOfWeek, addDays } from "date-fns";
import type { AppData, Food, Recipe } from "./types";

const foods: Food[] = [
  { id: "egg", name: "Eggs", unit: "piece", caloriesPerUnit: 78, location: "fridge", emoji: "🥚" },
  { id: "milk", name: "Milk", unit: "ml", caloriesPerUnit: 0.42, location: "fridge", emoji: "🥛" },
  { id: "chicken", name: "Chicken breast", unit: "g", caloriesPerUnit: 1.65, location: "fridge", emoji: "🍗" },
  { id: "spinach", name: "Spinach", unit: "g", caloriesPerUnit: 0.23, location: "fridge", emoji: "🥬" },
  { id: "tomato", name: "Tomatoes", unit: "piece", caloriesPerUnit: 22, location: "fridge", emoji: "🍅" },
  { id: "cheese", name: "Cheddar cheese", unit: "g", caloriesPerUnit: 4.0, location: "fridge", emoji: "🧀" },
  { id: "yogurt", name: "Greek yogurt", unit: "g", caloriesPerUnit: 0.59, location: "fridge", emoji: "🍶" },
  { id: "butter", name: "Butter", unit: "g", caloriesPerUnit: 7.2, location: "fridge", emoji: "🧈" },
  { id: "rice", name: "Rice", unit: "g", caloriesPerUnit: 1.3, location: "pantry", emoji: "🍚" },
  { id: "oats", name: "Oats", unit: "g", caloriesPerUnit: 3.8, location: "pantry", emoji: "🌾" },
  { id: "pasta", name: "Pasta", unit: "g", caloriesPerUnit: 3.7, location: "pantry", emoji: "🍝" },
  { id: "oliveoil", name: "Olive oil", unit: "ml", caloriesPerUnit: 8.8, location: "pantry", emoji: "🫒" },
  { id: "banana", name: "Bananas", unit: "piece", caloriesPerUnit: 105, location: "pantry", emoji: "🍌" },
  { id: "bread", name: "Bread", unit: "piece", caloriesPerUnit: 80, location: "pantry", emoji: "🍞" },
  { id: "honey", name: "Honey", unit: "tbsp", caloriesPerUnit: 64, location: "pantry", emoji: "🍯" },
  { id: "berries", name: "Mixed berries", unit: "g", caloriesPerUnit: 0.57, location: "freezer", emoji: "🫐" },
];

const recipes: Recipe[] = [
  {
    id: "veggie-omelette",
    name: "Spinach & Cheese Omelette",
    servings: 1,
    emoji: "🍳",
    ingredients: [
      { foodId: "egg", quantity: 3 },
      { foodId: "spinach", quantity: 40 },
      { foodId: "cheese", quantity: 30 },
      { foodId: "butter", quantity: 10 },
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
      { foodId: "oats", quantity: 60 },
      { foodId: "milk", quantity: 180 },
      { foodId: "yogurt", quantity: 80 },
      { foodId: "berries", quantity: 70 },
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
      { foodId: "chicken", quantity: 300 },
      { foodId: "rice", quantity: 150 },
      { foodId: "spinach", quantity: 80 },
      { foodId: "oliveoil", quantity: 15 },
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
      { foodId: "pasta", quantity: 200 },
      { foodId: "tomato", quantity: 4 },
      { foodId: "cheese", quantity: 50 },
      { foodId: "oliveoil", quantity: 15 },
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
      { foodId: "butter", quantity: 8 },
    ],
    steps: [
      "Toast and butter the bread.",
      "Top with sliced banana and a drizzle of honey.",
    ],
  },
];

const inventory = [
  { foodId: "egg", quantity: 8 },
  { foodId: "milk", quantity: 1000 },
  { foodId: "chicken", quantity: 250 },
  { foodId: "spinach", quantity: 150 },
  { foodId: "tomato", quantity: 5 },
  { foodId: "cheese", quantity: 120 },
  { foodId: "yogurt", quantity: 400 },
  { foodId: "butter", quantity: 200 },
  { foodId: "rice", quantity: 500 },
  { foodId: "oats", quantity: 400 },
  { foodId: "pasta", quantity: 250 },
  { foodId: "oliveoil", quantity: 500 },
  { foodId: "banana", quantity: 4 },
  { foodId: "bread", quantity: 6 },
  { foodId: "honey", quantity: 20 },
  { foodId: "berries", quantity: 300 },
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
  goals: { dailyCalorieTarget: 2000 },
};
