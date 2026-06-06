"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppData,
  Food,
  PlannedMeal,
  Recipe,
} from "./types";
import { seedData } from "./seed";

interface AppState extends AppData {
  // Inventory
  setInventory: (foodId: string, quantity: number) => void;
  // Foods
  addFood: (food: Food) => void;
  // Recipes
  addRecipe: (recipe: Recipe) => void;
  removeRecipe: (id: string) => void;
  // Plan
  addPlannedMeal: (meal: PlannedMeal) => void;
  removePlannedMeal: (id: string) => void;
  // Goals
  setDailyCalorieTarget: (target: number) => void;
  // Utilities
  resetToSeed: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const newId = uid;

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...seedData,

      setInventory: (foodId, quantity) =>
        set((s) => {
          const exists = s.inventory.find((i) => i.foodId === foodId);
          const inventory = exists
            ? s.inventory.map((i) =>
                i.foodId === foodId ? { ...i, quantity: Math.max(0, quantity) } : i,
              )
            : [...s.inventory, { foodId, quantity: Math.max(0, quantity) }];
          return { inventory };
        }),

      addFood: (food) =>
        set((s) => ({
          foods: [...s.foods, food],
          inventory: [...s.inventory, { foodId: food.id, quantity: 0 }],
        })),

      addRecipe: (recipe) => set((s) => ({ recipes: [...s.recipes, recipe] })),

      removeRecipe: (id) =>
        set((s) => ({
          recipes: s.recipes.filter((r) => r.id !== id),
          plan: s.plan.filter((p) => p.recipeId !== id),
        })),

      addPlannedMeal: (meal) => set((s) => ({ plan: [...s.plan, meal] })),

      removePlannedMeal: (id) =>
        set((s) => ({ plan: s.plan.filter((p) => p.id !== id) })),

      setDailyCalorieTarget: (target) =>
        set((s) => ({ goals: { ...s.goals, dailyCalorieTarget: target } })),

      resetToSeed: () => set({ ...seedData }),
    }),
    { name: "mealplan-store-v1" },
  ),
);

// ---- Derived selectors (the "everything stays in sync" logic) ----

export function foodById(foods: Food[], id: string) {
  return foods.find((f) => f.id === id);
}

/** Calories for one serving of a recipe, derived from its ingredients. */
export function recipeCaloriesPerServing(recipe: Recipe, foods: Food[]): number {
  const total = recipe.ingredients.reduce((sum, ing) => {
    const food = foodById(foods, ing.foodId);
    return sum + (food ? food.caloriesPerUnit * ing.quantity : 0);
  }, 0);
  return Math.round(total / recipe.servings);
}

/** Total quantity of each food required by a set of planned meals. */
export function neededQuantities(
  meals: PlannedMeal[],
  recipes: Recipe[],
): Record<string, number> {
  const need: Record<string, number> = {};
  for (const meal of meals) {
    const recipe = recipes.find((r) => r.id === meal.recipeId);
    if (!recipe) continue;
    const factor = meal.servings / recipe.servings;
    for (const ing of recipe.ingredients) {
      need[ing.foodId] = (need[ing.foodId] ?? 0) + ing.quantity * factor;
    }
  }
  return need;
}
